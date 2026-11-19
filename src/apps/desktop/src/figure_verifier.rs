//! The producing desktop shell checks a figure without navigating a webview.
use openbitfun_core::agentic::inline_figure::register_figure_verifier;
use std::{sync::Arc, time::Duration};
use tauri::{AppHandle, Emitter, EventTarget, Listener, Manager};

pub(crate) fn install(app: AppHandle) {
    register_figure_verifier(Arc::new(move |source| {
        let app = app.clone();
        Box::pin(async move {
            if app.get_webview("main").is_none() {
                return Err("FlowChat renderer unavailable on the producing device".into());
            }
            let id = uuid::Uuid::new_v4();
            let reply = format!("figure-check-result-{id}");
            let (send, receive) = tokio::sync::oneshot::channel();
            let handle = app.once(reply, move |event| {
                let result =
                    serde_json::from_str::<Result<Option<String>, String>>(event.payload())
                        .map_err(|_| "Invalid renderer response".to_owned())
                        .and_then(|result| result);
                let _ = send.send(result);
            });
            // Also unsubscribe if the tool future is cancelled or the shell reloads.
            struct Subscription(AppHandle, tauri::EventId);
            impl Drop for Subscription {
                fn drop(&mut self) {
                    self.0.unlisten(self.1);
                }
            }
            let _subscription = Subscription(app.clone(), handle);
            app.emit_to(
                EventTarget::webview("main"),
                "figure-check",
                serde_json::json!({"id": id, "source": source}),
            )
            .map_err(|e| e.to_string())?;
            tokio::time::timeout(Duration::from_secs(20), receive)
                .await
                .map_err(|_| {
                    "FlowChat renderer did not respond on the producing device".to_owned()
                })?
                .map_err(|_| "FlowChat renderer disconnected".to_owned())?
        })
    }));
}
