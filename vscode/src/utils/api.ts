import * as vscode from 'vscode';

export const ISDEV = 'true';
export const USERID = vscode.env.machineId;

export const LOGSIGHTBASE = ISDEV ? 'http://localhost:8080' : 'https://logsight.ai';
export const LOGS_WRITE = LOGSIGHTBASE + '/api/v1/logs/autolog';

