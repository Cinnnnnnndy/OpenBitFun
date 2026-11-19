//! The identity of a replayable FlowChat figure belongs to the producing session.
use std::path::Path;

use super::tools::framework::{ToolPathResolution, ToolUseContext};

const URI_PREFIX: &str = "openbitfun://current-session/artifacts/visualizations/v2/";
pub(super) const MAX_SOURCE_BYTES: usize = 1024 * 1024;

pub(super) fn figure_uri(path: &str, session_dir: Option<&Path>) -> Option<String> {
    let filename = if let Some(name) = path.strip_prefix(URI_PREFIX) {
        name
    } else {
        let path = Path::new(path);
        if !path.is_absolute() || path.parent()? != session_dir?.join("artifacts/visualizations/v2")
        {
            return None;
        }
        path.file_name()?.to_str()?
    };
    let slug = filename.strip_suffix(".html")?;
    if slug.is_empty()
        || slug.len() > 96
        || slug.starts_with('-')
        || !slug
            .bytes()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-')
    {
        return None;
    }
    Some(format!("{URI_PREFIX}{filename}"))
}

pub(super) fn written_figure_uri(
    context: &ToolUseContext,
    path: &ToolPathResolution,
) -> Option<String> {
    if path.uses_remote_workspace_backend() {
        return None;
    }
    if path.logical_path.starts_with(URI_PREFIX) {
        return figure_uri(&path.logical_path, None);
    }
    if !path.logical_path.ends_with(".html") {
        return None;
    }
    let root = context
        .current_workspace_session_dir(context.session_id.as_deref()?)
        .ok()?;
    figure_uri(&path.resolved_path, Some(&root))
}

pub(super) fn reference_hint(uri: &str) -> String {
    format!("\nFlowChat has the inline source. To display it, put this reference on its own line in your final reply:\nvisualize{}", serde_json::json!({ "path": uri }))
}

/// Implemented by the producing host. Headless runtimes defer the check to the reader.
pub type FigureVerifier = std::sync::Arc<
    dyn Fn(
            String,
        ) -> std::pin::Pin<
            Box<dyn std::future::Future<Output = Result<Option<String>, String>> + Send>,
        > + Send
        + Sync,
>;
static VERIFIER: std::sync::OnceLock<FigureVerifier> = std::sync::OnceLock::new();
pub fn register_figure_verifier(verifier: FigureVerifier) {
    let _ = VERIFIER.set(verifier);
}

pub(super) async fn verify_written_figure(
    uri: &str,
    source: &str,
    data: &mut serde_json::Value,
    message: &mut String,
) {
    let Some(verifier) = VERIFIER.get() else {
        message.push_str("\nThis runtime has no background renderer. FlowChat will check this revision on display.");
        message.push_str(&reference_hint(uri));
        return;
    };
    match verifier(source.to_owned()).await.and_then(|rendered| {
        if rendered
            .as_ref()
            .is_some_and(|s| s.is_empty() || s.len() > MAX_SOURCE_BYTES)
        {
            Err("Invalid rendered figure size".to_owned())
        } else {
            Ok(rendered)
        }
    }) {
        Ok(rendered) => {
            if let Some(html) = rendered {
                data["visualization_rendered_bytes"] = html.len().into();
                data["visualization_rendered_source"] = html.into();
            }
            data["visualization_checked"] = true.into();
            message
                .push_str("\nFlowChat rendered and checked this exact revision in the background.");
            message.push_str(&reference_hint(uri));
        }
        Err(issue) => {
            data["visualization_checked"] = false.into();
            let issue: String = issue.chars().take(500).collect();
            message.push_str(&format!("\nFlowChat could not publish this revision: {issue}. Fix the fragment using Edit or Write at the same destination. The host repeats the check automatically."));
        }
    }
}
