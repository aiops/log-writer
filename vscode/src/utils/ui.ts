import * as vscode from 'vscode';
import { FEEDBACK } from './api';
import axios from 'axios';
import { TokenManager } from '../TokenManager';


export const changeProgressColor = () => {
	const workbenchConfig = vscode.workspace.getConfiguration('workbench');
	const currentColorScheme = workbenchConfig.get('colorCustomizations') as any;
	const mintlifyColorScheme = {
		"[*Dark*]": {
      "progressBar.background": "#0D9373",
      "notificationsInfoIcon.foreground": "#0D9373",
			"editor.selectionBackground": "#0D937333"
    },
    "[*Light*]": {
			"progressBar.background": "#0D9373",
      "notificationsInfoIcon.foreground": "#0D9373",
			"editor.selectionBackground": "#0D937333"
    }
	};
	workbenchConfig.update('colorCustomizations', {...currentColorScheme, ...mintlifyColorScheme}, true);
};

export const removeProgressColor = () => {
	const workbenchConfig = vscode.workspace.getConfiguration('workbench');
	const currentColorScheme = workbenchConfig.get('colorCustomizations') as any;
	const { ['[*Dark*]']: defaultDark, ['[*Light*]']: defaultLight, ...removedScheme } = currentColorScheme;
	workbenchConfig.update('colorCustomizations', removedScheme, true);
};


export const askForFeedbackNotification = async (feedbackId: string): Promise<boolean | null> => {
	const feedbackOption = await vscode.window.showInformationMessage('Are the results useful?', '👍 Yes', '👎 No');
	if (feedbackOption == null) {return null;}

	const feedbackScore = feedbackOption === '👍 Yes' ? true : false;

	axios.post(FEEDBACK, {
		autoLogId: feedbackId,
		isHelpful: feedbackScore,
	},
	{
		headers: 
		{
		// eslint-disable-next-line @typescript-eslint/naming-convention
		"Content-Type": "application/json",
		// eslint-disable-next-line @typescript-eslint/naming-convention
		"Authorization": "Bearer " + TokenManager.getToken(),
		}}
		);

	return feedbackScore;
};