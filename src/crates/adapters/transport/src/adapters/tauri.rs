//! Tauri transport adapter.
//!
//! This adapter owns only Tauri delivery. Agentic event names and payload
//! shapes are projected by `openbitfun-events`.

#[cfg(feature = "tauri-adapter")]
use crate::traits::TransportAdapter;
use async_trait::async_trait;
use log::warn;
use openbitfun_events::{project_agentic_frontend_event, AgenticEvent};
#[cfg(feature = "tauri-adapter")]
use serde::{Deserialize, Serialize};
use std::fmt;

#[cfg(feature = "tauri-adapter")]
use tauri::{AppHandle, Emitter};

#[cfg(feature = "tauri-adapter")]
pub const TAURI_EVENT_BATCH_NAME: &str = "agentic://event-batch";

#[cfg(feature = "tauri-adapter")]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TauriBatchedEvent {
    pub event: String,
    pub payload: serde_json::Value,
}

#[cfg(feature = "tauri-adapter")]
pub struct TauriTransportAdapter {
    app_handle: AppHandle,
}

#[cfg(feature = "tauri-adapter")]
impl TauriTransportAdapter {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// Deliver one or more ordered frontend events across a single Tauri IPC
    /// boundary when multiple events drain in the same window.
    pub fn emit_batch(&self, mut events: Vec<TauriBatchedEvent>) -> anyhow::Result<()> {
        match events.len() {
            0 => Ok(()),
            1 => {
                let item = events.pop().expect("single item checked above");
                self.app_handle.emit(&item.event, item.payload)?;
                Ok(())
            }
            _ => {
                self.app_handle.emit(TAURI_EVENT_BATCH_NAME, events)?;
                Ok(())
            }
        }
    }
}

#[cfg(feature = "tauri-adapter")]
impl fmt::Debug for TauriTransportAdapter {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("TauriTransportAdapter")
            .field("adapter_type", &"tauri")
            .finish()
    }
}

#[cfg(feature = "tauri-adapter")]
#[async_trait]
impl TransportAdapter for TauriTransportAdapter {
    async fn emit_event(&self, event: AgenticEvent) -> anyhow::Result<()> {
        let Some(projected) = project_agentic_frontend_event(event) else {
            warn!("Unhandled AgenticEvent type in TauriAdapter");
            return Ok(());
        };
        self.app_handle
            .emit(projected.event_name.as_str(), projected.payload)?;
        Ok(())
    }

    async fn emit_generic(
        &self,
        event_name: &str,
        payload: serde_json::Value,
    ) -> anyhow::Result<()> {
        self.app_handle.emit(event_name, payload)?;
        Ok(())
    }
}
