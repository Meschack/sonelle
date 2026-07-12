//! Creates child processes that must run without interrupting the reading surface.
//!
//! This module owns platform-specific process presentation. It deliberately does not own command
//! arguments, stream configuration, process lifetime, or error handling.

use std::{ffi::OsStr, process::Command};

/// Creates a command that stays in the background when launched by the desktop app.
pub(crate) fn background_command(program: impl AsRef<OsStr>) -> Command {
    let mut command = Command::new(program);
    configure_background_process(&mut command);
    command
}

#[cfg(windows)]
fn configure_background_process(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    // Prevent console applications such as Piper and Python from opening a terminal window when
    // their parent is Sonelle's windowed executable.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn configure_background_process(_command: &mut Command) {}
