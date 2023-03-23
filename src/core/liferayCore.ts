import * as vscode from 'vscode';
import Constants from '../constants';
import * as log4js from 'log4js';
import path = require('path');
import * as os from 'os';

export interface LiferayVscodeConfig {
    logLevel: string;
}

export class LiferayConfigManager {
    private readonly config: vscode.WorkspaceConfiguration;
    private readonly logger: log4js.Logger;

    constructor() {
        this.config = vscode.workspace.getConfiguration(Constants.LIFERAY_VSCODE_PLUGIN_NAME) as vscode.WorkspaceConfiguration;
        const extension = vscode.extensions.getExtension(Constants.EXTENSION_PUBLISHER + '.' + Constants.EXTENSION_PLUGIN_ID);
        if (extension){
            const version = extension?.packageJSON.version;
            const logDir = path.join(os.homedir(), Constants.EXTENSION_PUBLISHER, Constants.EXTENSION_PLUGIN_ID);
    
            log4js.configure({
                appenders: {
                    console: { 
                        type: 'console' 
                    },
                    file: { 
                        type: 'file', 
                        filename: path.join(logDir, 'plugin.log'),
                        maxLogSize: 1024 * 1024 * 10,
                        backups: 5,
                        compress: true,
                        pattern: '-yyyy-MM-dd',
                        layout: {
                          type: 'pattern',
                          pattern: '%d [%p] %m'
                        }                    
                    },
                },
                categories: {
                    default: { 
                        appenders: ['console', 'file'], level: 'debug' 
                    }
                }
            });
        }
  
        this.logger = log4js.getLogger(Constants.LIFERAY_VSCODE_PLUGIN_NAME);
    }

    public registerConfigChangeListener(): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
            if (event.affectsConfiguration(`${Constants.LIFERAY_VSCODE_PLUGIN_NAME}.logLevel`)) {
                console.log(`${Constants.LIFERAY_VSCODE_PLUGIN_NAME}.logLevel has been changed to ${this.getLogLevel()}`);
            }
        });
    }

    public getConfig(): LiferayVscodeConfig {
        return {
            logLevel: this.getLogLevel()
        };
    }

    public setDefaultConfig(): void {
        this.config.update('logLevel', 'info', vscode.ConfigurationTarget.Global);
        this.logger.info(`Default config has been set: ${JSON.stringify(this.getConfig())}`);
    }

    public getLogLevel(): string {
        return this.config.get('logLevel', 'info');
    }

    public setLogLevel(value: string): void {
        this.config.update('logLevel', value, vscode.ConfigurationTarget.Global);
        this.logger.info(`${Constants.LIFERAY_VSCODE_PLUGIN_NAME}.logLevel has been set to ${value}`);
    }

    public getLogger(): log4js.Logger {
        return this.logger;
    }
}