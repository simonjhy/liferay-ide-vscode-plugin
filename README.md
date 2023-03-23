# liferay-ide-vscode-plugin README

    Liferay IDE VsCode plugin is a vscode plugins created by Liferay, Inc. to support developing liferay workspace project, module project and client 

    extesion project for the Liferay Portal platform.

    To get started, check out the project's community homepage at https://github.com/simonjhy/liferay-ide-vscode-plugin

    To install the Liferay IDE voscode plugins into your vscode install from zip file or use vscode marketplace. Via the command menu (`Cmd+Shift+P` on macOS 

    or `Ctrl+Shift+P` on Windows and Linux) and may be bound to keys in the normal way, you can find commands start with New Liferay.

## Features

    Will support to most functions has been provided by Liferay IDE and Liferay Intellij. Will have good developing support for client-extension and 

    css. Will add Liferay Portal Server base on VSCode RSP UI Extension and will be  along with VSCode Community Server Connector Extension. 

## Requirements

- [VS Code >= 1.76.0](https://code.visualstudio.com/download)
- [Java >= 8](https://adoptopenjdk.net/)

## Extension Settings

    We will add related configuration for feature, we don't need extra configuration now.

## Known Issues

## Release Notes

    Users appreciate release notes as you update your extension.

### 0.0.1

    add workspace project wizard

    add moudle project wizard

    add client extensnion wizard

## Questions & Issues

    Each extension mentioned above is a separate open-source project and has its own repository. To make things easier, simply [🙋 open an issue in this repository](https://github.com/simonjhy/liferay-ide-vscode-plugin/issues). The new issue will be triaged and redirected.


## Building this server and extension

    Run the following code:

    # First, build the server
    git clone https://github.com/simonjhy/liferay-ide-vscode-plugin

    cd liferay-ide-vscode-plugin/

    #Build this extension's code
    yarn install
    vsce package
