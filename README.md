# Nag

Nag (EQ Nag) is a trigger, timer and overlay app for EverQuest. It reads your
EverQuest log file and shows alerts, timers and combat information on screen.

## Download

Download Nag only from the
[Releases page](https://github.com/guildantix/eq-nag/releases). After you
install it, Nag updates itself.

## Is this download safe?

Every installer is built automatically by GitHub Actions from the public
source code in this repository; nobody builds releases on their own computer.

- **Build attestation:** each release comes with a GitHub-signed record
  proving the file was built by this repository's release workflow. To check
  a download with the [GitHub CLI](https://cli.github.com/):

  ```
  gh attestation verify EQ-Nag-Setup-<version>.exe --repo guildantix/eq-nag
  ```

- **Checksum:** the Releases page shows each file's SHA-256. To compare it
  with your download, run this in PowerShell:

  ```
  Get-FileHash EQ-Nag-Setup-<version>.exe
  ```

- **Unsigned installer:** the installer isn't code-signed, so Windows
  SmartScreen may say it's from an unknown publisher the first time you run
  it. Click "More info", then "Run anyway".

- **Updates:** Nag only downloads updates from this repository's releases and
  checks each file's SHA-512 before installing it.

Maintainers: see [RELEASING.md](RELEASING.md).
