import * as vscode from "vscode";


const KEY = 'logsightlogintoken';

export class TokenManager {
    static globalState: vscode.Memento;

    static setToken(token: string) {
        return this.globalState.update(KEY, token);
    }
    static getToken() {
        return this.globalState.get(KEY);
    }

    static removeToken() {
        return this.globalState.update(KEY, "");
    }
}