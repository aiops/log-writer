import * as vscode from 'vscode';
import axios, { AxiosError } from 'axios';
import { SidebarProvider } from './SidebarProvider';
import { TokenManager } from "./TokenManager";
import { changeProgressColor, removeProgressColor, shareNotification } from './utils/ui';
import { getDocStyleConfig, getCustomConfig, getHighlightedText, getWidth } from './utils/utils';
import { hotkeyConfigProperty, KEYBINDING_DISPLAY } from './constants';
import { LOGS_WRITE } from './utils/api';


const LANGUAGES_SUPPORT = ['python'];


export function activate(context: vscode.ExtensionContext) {

// SIDEVIEW AUTH

	TokenManager.globalState = context.globalState;
	const sidebarProvider = new SidebarProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			"autologger-sidebar",
			sidebarProvider
		)
	);

// GETTING PREDICTIONS

	const write = vscode.commands.registerCommand('autologger.write', async () => {
		if (!TokenManager.getToken()){
			vscode.window.showInformationMessage("Please login at logsight.ai AutoLogger extension and try again");
			return;
		}

		changeProgressColor();
		const editor = vscode.window.activeTextEditor;
		if (editor == null) {
			removeProgressColor();
			return;
		}

		const { languageId, getText, fileName } = editor.document;

		const { selection, highlighted } = getHighlightedText(editor);
		let location: number | null = null;
		let line: vscode.TextLine | null = null;

		// Used for cursor placement
		const startLine = selection.start.line;

		if (!highlighted) {
			removeProgressColor();
			let document = editor.document;
			let curPos = editor.selection.active;
			location = document.offsetAt(curPos);
			line = document.lineAt(curPos);
			if (line.isEmptyOrWhitespace) {
				vscode.window.showErrorMessage(`Please select a line with code and enter ${KEYBINDING_DISPLAY()} again`);
				return;
			}
			if (!LANGUAGES_SUPPORT.includes(languageId)) {
				vscode.window.showErrorMessage(`Please select code and enter ${KEYBINDING_DISPLAY()} again`);
				return;
			}
		}

		vscode.window.withProgress({
	location: vscode.ProgressLocation.Notification,
	title: 'Generating logging statements',
	}, async () => {
			const docsPromise = new Promise(async (resolve, _) => {
				try {
					const { data } = await axios.post(LOGS_WRITE,
						{
							"languageId": languageId,
							"fileName": fileName,
							"source": "vscode",
							"context": getText()
						},
						{
							headers: 
							{
							// eslint-disable-next-line @typescript-eslint/naming-convention
							"Content-Type": "application/json",
							// eslint-disable-next-line @typescript-eslint/naming-convention
							"Authorization": "Bearer " + TokenManager.getToken(),
							}
						});
					vscode.commands.executeCommand('autologger.insert', {
						position: data['listAutoLogs'][0]['position'],
						content: data['listAutoLogs'][0]['logMessage'],
						selection: selection
					});
					resolve('Completed generating');
					removeProgressColor();
				} catch (err: AxiosError | any) {
				
					vscode.window.showErrorMessage(JSON.stringify(err));
					resolve('Error');
					removeProgressColor();
				}
			});
			
			await docsPromise;
		});
	});

	const insert = vscode.commands.registerCommand('autologger.insert', async (
		{ position, content, selection }: { position: 'above' | 'belowStartLine', content: string, selection: vscode.Selection }
	) => {
		const editor = vscode.window.activeTextEditor;
		if (editor == null) { return; }

		if (position === 'belowStartLine') {
			const start = selection.start.line;
			const startLine = editor.document.lineAt(start);

			const tabbedDocstring = content.split('\n').map((line: string) => `\t${line}`).join('\n');
			const snippet = new vscode.SnippetString(`\n${tabbedDocstring}`);
			editor.insertSnippet(snippet, startLine.range.end);
		} else if (position === 'above') {
			const snippet = new vscode.SnippetString(`${content}\n`);
			let position;
			if (selection.start.line == selection.end.line && selection.start.character == selection.end.character) {
				let document = editor.document;
				const curPos = editor.selection.active;
				const desiredLine = document.lineAt(curPos);
				const lineNum : number = desiredLine.range.start.line;
				position = new vscode.Position(lineNum, desiredLine.firstNonWhitespaceCharacterIndex);
			} else {
				position = selection.start;
			}
			console.log(snippet, position);
			editor.insertSnippet(snippet, position);
		}
	});

	context.subscriptions.push(
		write, insert,
	);

}

// This method is called when your extension is deactivated
export function deactivate() {}
