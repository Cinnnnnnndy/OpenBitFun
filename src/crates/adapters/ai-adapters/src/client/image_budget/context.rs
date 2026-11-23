//! Pixel projection for one outgoing request. All positions refer to the
//! provider-neutral messages before the adapter merges roles and tool results.

use super::{inline_media, is_content_part, is_image_part};
use crate::client::format::ApiFormat;
use crate::providers::openai::OpenAIMessageConverter;
use crate::types::{AIConfig, Message, ModelRequestContext, ToolDefinition};
use crate::vision_tokens::{
    inline_image_dimensions, ResizedInlineImage, VisionTokenPolicy, UNKNOWN_IMAGE_DIMENSIONS,
};
use anyhow::Result;
use openbitfun_core_types::errors::{AiProviderError, ErrorCategory};
use openbitfun_core_types::token_estimate::{
    automatic_max_output_tokens, TokenCounter, INPUT_SAFETY_RESERVE,
};
use serde_json::{json, Value};
use std::collections::BTreeMap;

const OMITTED: &str = "[Earlier image omitted to fit the context window.]";

struct Image {
    message: usize,
    part: usize,
    dimensions: Option<(u32, u32)>,
    policy: VisionTokenPolicy,
    cost: usize,
    minimum: usize,
    target: usize,
}

impl Image {
    fn new(
        policy: VisionTokenPolicy,
        message: usize,
        part: usize,
        inline: Option<(&str, &str)>,
        resizable: bool,
    ) -> Self {
        let dimensions = inline.and_then(|(mime, data)| inline_image_dimensions(mime, data));
        // Opaque URLs/file IDs are never fetched here. Budget an ordinary
        // full-size input and retain it intact whenever it is current.
        let (w, h) = dimensions.unwrap_or(UNKNOWN_IMAGE_DIMENSIONS);
        let cost = policy.estimate(w, h);
        let minimum = if dimensions.is_some() && resizable {
            policy.min_readable_tokens(w, h)
        } else {
            cost
        };
        Self {
            message,
            part,
            dimensions,
            policy,
            cost,
            minimum,
            target: cost,
        }
    }

    fn preview_note(&self, width: u32, height: u32) -> String {
        let (w, h) = self.dimensions.expect("resizable image dimensions");
        format!(
            "[Image {} preview {width}x{height} from {w}x{h}.]",
            self.part + 1
        )
    }
}

fn part_policy(policy: VisionTokenPolicy, part: &Value) -> VisionTokenPolicy {
    let detail = part["image_url"]["detail"]
        .as_str()
        .or_else(|| part["detail"].as_str());
    policy.with_detail(detail)
}

fn part_payload(part: &Value) -> Option<(&str, &str)> {
    if let Some(source) = part.get("source") {
        if let (Some(mime), Some(data)) = (source["media_type"].as_str(), source["data"].as_str()) {
            return Some((mime, data));
        }
    }
    if let Some(inline) = inline_media(part) {
        return Some(inline);
    }
    let value = part
        .get("image_url")
        .or_else(|| part.get("source")?.get("url"))?;
    let url = value.as_str().or_else(|| value.get("url")?.as_str())?;
    let (mime, data) = url.strip_prefix("data:")?.split_once(";base64,")?;
    Some((mime, data))
}

fn replace_payload(part: &mut Value, image: ResizedInlineImage) {
    if let Some(source) = part
        .get_mut("source")
        .filter(|source| source.get("data").is_some())
    {
        source["media_type"] = image.mime_type.into();
        source["data"] = image.data_base64.into();
    } else if let Some(key) = ["inline_data", "inlineData"]
        .into_iter()
        .find(|k| part.get(k).is_some())
    {
        let data = &mut part[key];
        let mime_key = if data.get("mimeType").is_some() {
            "mimeType"
        } else {
            "mime_type"
        };
        data[mime_key] = image.mime_type.into();
        data["data"] = image.data_base64.into();
    } else {
        let data_url = Value::String(format!(
            "data:{};base64,{}",
            image.mime_type, image.data_base64
        ));
        if let Some(value) = part.get_mut("image_url") {
            if value.is_object() {
                value["url"] = data_url;
            } else {
                *value = data_url;
            }
        } else {
            part["source"]["url"] = data_url;
        }
    }
}

fn image_budget_error(message: String) -> anyhow::Error {
    // Provider context overflows trigger session compaction. This request
    // needs a different image or a smaller batch, so return the crop guidance.
    AiProviderError::classified(message, ErrorCategory::InvalidRequest).into()
}

fn resize_preview(
    policy: VisionTokenPolicy,
    mime: &str,
    data: &str,
    target: usize,
) -> Result<ResizedInlineImage> {
    policy.resize(mime, data, target).map_err(|error| {
        AiProviderError::classified(
            format!("Unable to prepare a smaller image preview: {error}. Supply a still image or a crop of the relevant region."),
            ErrorCategory::InvalidRequest,
        ).into()
    })
}

fn output_reserve(config: &AIConfig, extra: Option<&Value>) -> usize {
    let default = if config.format.eq_ignore_ascii_case("anthropic") {
        32_000
    } else {
        automatic_max_output_tokens(config.context_window)
    };
    let configured = config.max_tokens.unwrap_or(default) as usize;
    // Custom request bodies can raise the wire output cap on compatible gateways.
    [
        "/max_tokens",
        "/max_completion_tokens",
        "/max_output_tokens",
        "/generationConfig/maxOutputTokens",
    ]
    .into_iter()
    .filter_map(|path| extra?.pointer(path)?.as_u64())
    .fold(configured, |cap, value| {
        cap.max(usize::try_from(value).unwrap_or(usize::MAX))
    })
}

/// Admission facts captured from the client selected for *this* send.
pub(in crate::client) struct Budget {
    format: Option<ApiFormat>,
    policy: VisionTokenPolicy,
    limit: usize,
    tools: usize,
    schema: usize,
    text_floor: usize,
    turn_start: Option<usize>,
}

impl Budget {
    pub(in crate::client) fn for_request(
        config: &AIConfig,
        tools: Option<&[ToolDefinition]>,
        context: Option<&ModelRequestContext>,
        extra: Option<&Value>,
    ) -> Self {
        let window = config.context_window as usize;
        // Leave input space for clients whose entire window is smaller than
        // the ordinary compression safety reserve.
        let limit = window
            .saturating_sub(output_reserve(config, extra))
            .saturating_sub(INPUT_SAFETY_RESERVE.min(window / 3));
        let wire_overhead = |value: &Value| TokenCounter::estimate_tokens(&value.to_string());
        let schema = context
            .and_then(|ctx| ctx.output_schema.as_ref())
            .map_or(0, wire_overhead);
        let schema = schema
            + [
                "/instructions",
                "/system",
                "/systemInstruction",
                "/response_format",
                "/text/format",
                "/generationConfig/responseSchema",
            ]
            .into_iter()
            .filter_map(|p| extra?.pointer(p))
            .map(wire_overhead)
            .sum::<usize>();
        let tools = tools
            .map_or(0, TokenCounter::estimate_tool_definitions_tokens)
            .max(
                extra
                    .and_then(|body| body.get("tools"))
                    .map_or(0, wire_overhead),
            );
        let format = ApiFormat::parse(&config.format).ok();
        let body_selects_model = !crate::client::utils::is_trim_custom_request_body_mode(config)
            && matches!(
                format,
                Some(ApiFormat::OpenAIChat | ApiFormat::OpenAIResponses | ApiFormat::Anthropic)
            );
        let model = if body_selects_model {
            extra
                .and_then(|body| body["model"].as_str())
                .unwrap_or(&config.model)
        } else {
            &config.model
        };
        let mut policy = VisionTokenPolicy::for_model(model);
        if matches!(
            format,
            Some(ApiFormat::Gemini | ApiFormat::GeminiCodeAssist)
        ) {
            let generation = extra.and_then(|body| {
                body.get("generationConfig")
                    .or_else(|| body.get("generation_config"))
            });
            policy = policy.with_gemini_media_resolution(generation.and_then(|config| {
                config
                    .get("mediaResolution")
                    .or_else(|| config.get("media_resolution"))?
                    .as_str()
            }));
        }
        Self {
            format,
            policy,
            limit,
            tools,
            schema,
            text_floor: context.map_or(0, |ctx| ctx.minimum_non_image_input_tokens),
            turn_start: context.and_then(|ctx| ctx.image_turn_start),
        }
    }
}

/// A raw provider message override has no application turn or attachment identity.
/// Keep it intact when it fits; report oversized image overrides before transport.
pub(in crate::client) fn validate_override(
    config: &AIConfig,
    messages: &[Message],
    tools: Option<&[ToolDefinition]>,
    context: Option<&ModelRequestContext>,
    body: Option<&Value>,
) -> Result<bool> {
    let Some(body) = body else { return Ok(false) };
    let (key, system_key) = match ApiFormat::parse(&config.format)? {
        ApiFormat::OpenAIChat => ("messages", None),
        ApiFormat::Anthropic => ("messages", Some("system")),
        ApiFormat::OpenAIResponses => ("input", Some("instructions")),
        ApiFormat::Gemini | ApiFormat::GeminiCodeAssist => ("contents", Some("systemInstruction")),
    };
    let Some(override_messages) = body.get(key) else {
        return Ok(false);
    };
    if crate::client::utils::is_trim_custom_request_body_mode(config) {
        return Ok(false);
    }
    fn count(
        value: &Value,
        policy: VisionTokenPolicy,
        gemini: bool,
        saw_image: &mut bool,
    ) -> usize {
        let file_image = gemini
            && value
                .get("fileData")
                .or_else(|| value.get("file_data"))
                .and_then(|file| file.get("mimeType").or_else(|| file.get("mime_type")))
                .and_then(Value::as_str)
                .is_some_and(|mime| mime.starts_with("image/"));
        if is_image_part(value) || file_image {
            *saw_image = true;
            let policy = if gemini {
                let resolution = value
                    .get("mediaResolution")
                    .or_else(|| value.get("media_resolution"))
                    .and_then(|setting| setting["level"].as_str());
                policy.with_gemini_media_resolution(resolution)
            } else {
                part_policy(policy, value)
            };
            return Image::new(policy, 0, 0, part_payload(value), false).cost;
        }
        match value {
            Value::String(s) => TokenCounter::estimate_tokens(s) + 1,
            Value::Array(items) => items
                .iter()
                .map(|item| count(item, policy, gemini, saw_image))
                .sum(),
            Value::Object(fields) => fields
                .iter()
                .map(|(k, v)| {
                    TokenCounter::estimate_tokens(k) + 1 + count(v, policy, gemini, saw_image)
                })
                .sum(),
            _ => 1,
        }
    }
    let budget = Budget::for_request(config, tools, context, Some(body));
    let mut saw_image = false;
    let gemini = matches!(
        budget.format,
        Some(ApiFormat::Gemini | ApiFormat::GeminiCodeAssist)
    );
    let cost = count(override_messages, budget.policy, gemini, &mut saw_image);
    if saw_image {
        // Responses, Anthropic and Gemini send system messages in a separate
        // field, which survives an override of just input/messages/contents.
        let preserved_system = if system_key.is_some_and(|key| body.get(key).is_none()) {
            messages
                .iter()
                .filter(|message| message.role == "system")
                .map(TokenCounter::estimate_message_tokens)
                .sum()
        } else {
            0
        };
        if cost
            .saturating_add(preserved_system)
            .saturating_add(budget.tools + budget.schema + 3)
            > budget.limit
        {
            return Err(image_budget_error("Custom image messages exceed the input budget after reserving output. Use ordinary image attachments to allow automatic resizing.".into()));
        }
    }
    Ok(true)
}

pub(in crate::client) fn may_contain_images(message: &Message) -> bool {
    message
        .tool_image_attachments
        .as_ref()
        .is_some_and(|images| !images.is_empty())
        || (message.role == "user"
            && message
                .content
                .as_deref()
                .is_some_and(|s| s.trim_start().starts_with('[')))
}

#[cfg(test)]
pub(super) fn project(
    messages: &mut [Message],
    config: &AIConfig,
    tools: Option<&[ToolDefinition]>,
    context: Option<&ModelRequestContext>,
    extra: Option<&Value>,
) -> Result<()> {
    apply(messages, Budget::for_request(config, tools, context, extra))
}

// Desktop and browser control actions reuse the exact coordinates of their
// screenshots. A deferred call retains its gateway name on the wire.
fn can_resize_tool(message: &Message, history: &[Message]) -> bool {
    let mut name = message.name.as_deref();
    if name == Some("CallDeferredTool") {
        name = message.tool_call_id.as_deref().and_then(|id| {
            history
                .iter()
                .rev()
                .flat_map(|message| message.tool_calls.iter().flatten())
                .find(|call| call.id == id && call.name == "CallDeferredTool")
                .and_then(|call| call.arguments["tool_name"].as_str())
        });
    }
    !matches!(name, None | Some("ComputerUse" | "ControlHub"))
}

pub(in crate::client) fn apply(messages: &mut [Message], budget: Budget) -> Result<()> {
    let mut users = BTreeMap::new();
    let mut images = Vec::new();
    for (index, message) in messages.iter().enumerate() {
        if message.role == "tool" {
            if message
                .tool_image_attachments
                .as_ref()
                .is_none_or(Vec::is_empty)
            {
                continue;
            }
            let resizable = can_resize_tool(message, &messages[..index]);
            for (part, image) in message.tool_image_attachments.iter().flatten().enumerate() {
                images.push(Image::new(
                    budget.policy,
                    index,
                    part,
                    Some((&image.mime_type, &image.data_base64)),
                    resizable,
                ));
            }
        } else if message.role == "user" {
            let Some(content) = message
                .content
                .as_deref()
                .filter(|text| text.trim_start().starts_with('['))
            else {
                continue;
            };
            let Ok(parts) = serde_json::from_str::<Vec<Value>>(content) else {
                continue;
            };
            if matches!(
                budget.format,
                Some(ApiFormat::OpenAIChat | ApiFormat::OpenAIResponses)
            ) && !parts.iter().all(is_content_part)
            {
                // OpenAI renders unrecognized JSON arrays as literal user text.
                continue;
            }
            let before = images.len();
            for (part, value) in parts
                .iter()
                .enumerate()
                .filter(|(_, value)| is_image_part(value))
            {
                images.push(Image::new(
                    part_policy(budget.policy, value),
                    index,
                    part,
                    part_payload(value),
                    true,
                ));
            }
            if images.len() > before {
                if let Some(format @ (ApiFormat::OpenAIChat | ApiFormat::OpenAIResponses)) =
                    budget.format
                {
                    if let Some(part) = parts.iter().position(|part| {
                        !OpenAIMessageConverter::can_render_user_part(part, format)
                    }) {
                        return Err(AiProviderError::classified(
                            format!("Unsupported user content part at index {part} in an OpenAI image message. Use supported text and image parts."),
                            ErrorCategory::InvalidRequest,
                        ).into());
                    }
                }
                users.insert(index, parts);
            }
        }
    }
    if images.is_empty() {
        return Ok(());
    }

    let mut text = 3 + budget.tools;
    for (index, message) in messages.iter().enumerate() {
        let tokens = match users.get(&index) {
            None => TokenCounter::estimate_message_tokens(message),
            Some(parts) => {
                let text: usize = parts
                    .iter()
                    .filter(|p| !is_image_part(p))
                    .map(|part| {
                        part["text"].as_str().map_or_else(
                            || TokenCounter::estimate_tokens(&part.to_string()),
                            TokenCounter::estimate_tokens,
                        )
                    })
                    .sum();
                TokenCounter::estimate_message_overhead(message) + text
            }
        };
        text = text.saturating_add(tokens);
    }
    let text = text.max(budget.text_floor).saturating_add(budget.schema);
    let input_limit = budget.limit;
    let mut total = images
        .iter()
        .fold(text, |n, img| n.saturating_add(img.cost));
    if total <= input_limit {
        return Ok(());
    }

    let turn_start = budget
        .turn_start
        .or_else(|| messages.iter().rposition(|message| message.role == "user"))
        .unwrap_or(0)
        .min(messages.len());
    // Each assistant call batch starts a new model round, even when several
    // rounds answer the same user. Older observations were already sent.
    let current_start = messages[turn_start..]
        .iter()
        .rposition(|message| {
            message.role == "assistant"
                && message
                    .tool_calls
                    .as_ref()
                    .is_some_and(|calls| !calls.is_empty())
        })
        .map_or(turn_start, |index| turn_start + index);
    let marker_cost = 4 + TokenCounter::estimate_tokens(OMITTED);
    for image in images
        .iter_mut()
        .take_while(|img| img.message < current_start)
    {
        image.target = 0;
        total = total.saturating_sub(image.cost).saturating_add(marker_cost);
        if total <= input_limit {
            break;
        }
    }
    if total > input_limit {
        // Reserve the readable minimum of each current image first, then share
        // the remaining detail across them. Small images keep every pixel.
        let mut adjustable = Vec::new();
        let mut required = total;
        for (index, img) in images
            .iter()
            .enumerate()
            .filter(|(_, img)| img.target > img.minimum)
        {
            required = required.saturating_sub(img.cost - img.minimum);
            if messages[img.message].role == "tool" {
                let (w, h) = img.dimensions.expect("resizable image dimensions");
                required += TokenCounter::estimate_tokens(&img.preview_note(w, h)) + 4;
            }
            adjustable.push(index);
        }
        if required > input_limit {
            return Err(image_budget_error(format!(
                "Cannot fit the images and conversation in the model's context window with the requested output reserved ({required} estimated input tokens needed, {input_limit} available). Crop the relevant area, use fewer images, or shorten the conversation."
            )));
        }
        let mut spare = input_limit - required;
        adjustable.sort_by_key(|&i| images[i].cost - images[i].minimum);
        let mut count = adjustable.len();
        for index in adjustable {
            let image = &mut images[index];
            let extra = (spare / count).min(image.cost - image.minimum);
            image.target = image.minimum + extra;
            spare -= extra;
            count -= 1;
        }
    }

    let mut edited_users = std::collections::BTreeSet::new();
    // Remove tool attachments from the back so original positions stay valid.
    for image in images.iter().rev().filter(|img| img.target != img.cost) {
        let message = &mut messages[image.message];
        if let Some(parts) = users.get_mut(&image.message) {
            let part = &mut parts[image.part];
            if image.target == 0 {
                *part = json!({"type": "text", "text": OMITTED});
            } else {
                let (mime, data) =
                    part_payload(part).expect("resizable user image has inline data");
                replace_payload(
                    part,
                    resize_preview(image.policy, mime, data, image.target)?,
                );
            }
            edited_users.insert(image.message);
        } else {
            let attachments = message
                .tool_image_attachments
                .as_mut()
                .expect("tool image group");
            let note = if image.target == 0 {
                attachments.remove(image.part);
                OMITTED.to_owned()
            } else {
                let attachment = &mut attachments[image.part];
                let preview = resize_preview(
                    image.policy,
                    &attachment.mime_type,
                    &attachment.data_base64,
                    image.target,
                )?;
                let note = image.preview_note(preview.width, preview.height);
                attachment.mime_type = preview.mime_type;
                attachment.data_base64 = preview.data_base64;
                note
            };
            if attachments.is_empty() {
                message.tool_image_attachments = None;
            }
            let content = message.content.get_or_insert_with(String::new);
            content.push('\n');
            content.push_str(&note);
        }
    }
    for index in edited_users {
        messages[index].content = Some(serde_json::to_string(&users[&index])?);
    }
    Ok(())
}
