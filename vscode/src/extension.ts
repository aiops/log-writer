import * as vscode from 'vscode';
import axios, { AxiosError } from 'axios';
import { SidebarProvider } from './SidebarProvider';
import { TokenManager } from "./TokenManager";
import { changeProgressColor, removeProgressColor, askForFeedbackNotification } from './utils/ui';
import { KEYBINDING_DISPLAY } from './constants';
import { LOGS_WRITE } from './utils/api';


const LANGUAGES_SUPPORT = ['python'];
const LINE_THRESHOLD = 5;

export function activate(context: vscode.ExtensionContext) {

	TokenManager.globalState = context.globalState;
	const sidebarProvider = new SidebarProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			"log-writer-sidebar",
			sidebarProvider
		)
	);

	const write = vscode.commands.registerCommand('log-writer.write', async () => {
		if (!TokenManager.getToken()){
			vscode.window.showInformationMessage("Please login at logsight.ai Log writer extension and try again");
			return;
		}

		changeProgressColor();
		const editor = vscode.window.activeTextEditor;
		if (editor == null) {
			removeProgressColor();
			return;
		}

		const { languageId, getText, fileName } = editor.document;
		if (editor.document.lineCount < LINE_THRESHOLD){
			vscode.window.showInformationMessage(`Without sufficient code, we can not suggest any logging statements`);
			removeProgressColor();
			return;
		}

		if (!LANGUAGES_SUPPORT.includes(languageId)) {
			vscode.window.showErrorMessage(`Please select code and enter ${KEYBINDING_DISPLAY()} again`);
			return;
		}

		vscode.window.withProgress({
	location: vscode.ProgressLocation.Notification,
	title: 'Generating logging statements',
	}, async () => {
			const docsPromise = new Promise(async (resolve, _) => {
				try {
					const { data: {listWriteLogs: listWriteLogs, logWriteId: logWriterId, shouldShowFeedback} } = await axios.post(LOGS_WRITE,
						{
							"language": languageId,
							"fileName": fileName,
							"source": "vscode",
							"code": getText(),
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
					vscode.commands.executeCommand('log-writer.insert', {
						listWriteLogs: listWriteLogs
					});
					resolve('Completed generating');
					removeProgressColor();
					if (shouldShowFeedback) {
						const feedbackScore = await askForFeedbackNotification(logWriterId);
					}
				} catch (err: AxiosError | any) {
					resolve('Error');
					vscode.window.showErrorMessage("Log writer is still under development and has bugs, please report this bug to https://github.com/aiops/log-writer");
					removeProgressColor();
				}
			});
			
			await docsPromise;
		});
	});

	const insert = vscode.commands.registerCommand('log-writer.insert', async (
		{ listWriteLogs }
	) => {
		const editor = vscode.window.activeTextEditor;
		if (editor == null) { return; }
		for (let i=0; i< listWriteLogs.length; i++){
			const snippet = new vscode.SnippetString(`${listWriteLogs[i].log_message}\n`);
			let curPos = new vscode.Position(listWriteLogs[i].start_line_number + 1, 0);
			const desiredLine = editor.document.lineAt(curPos);
			let linePos = new vscode.Position(listWriteLogs[i].start_line_number + 1 + i, 0);
			editor.insertSnippet(snippet, linePos);
		}
	});

	context.subscriptions.push(
		write, insert,
	);

}

// This method is called when your extension is deactivated
export function deactivate() {}
