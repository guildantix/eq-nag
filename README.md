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

## Development

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 10.0.1.

### Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

### Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

### Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

### Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

### Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

### Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
