import * as vscode from 'vscode';
import { FEEDBACK } from './api';
import axios from 'axios';
import { TokenManager } from '../TokenManager';

const MARKETPLACE_URL = 'https://marketplace.visualstudio.com/items?itemname=mintlify.document';

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

export const configUserSettings = () => {
	// Remove color scheme in case left over
	removeProgressColor();
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

const generateTweetIntentUrl = () => {
	const text = encodeURI('Check out Doc Writer for VSCode by @mintlify. It just generated documentation for me in a second');
	const url = MARKETPLACE_URL;
	return `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
};

const generateFacebookIntentUrl = () => {
	const url = MARKETPLACE_URL;
	return `https://www.facebook.com/sharer.php?u=${url}`;
};

const generateMailToUrl = () => {
	const subject = encodeURI('Check out Mintlify Doc Writer');
	const body = MARKETPLACE_URL;
	return `mailto:?to=&subject=${subject}&body=${body}`;
};

export const shareNotification = async (): Promise<void> => {
	const shareOption = await vscode.window.showInformationMessage('Share Doc Writer with your friends', 'Twitter', 'Facebook', 'Email', 'Copy link');

	switch (shareOption) {
		case 'Twitter':
			const tweetUrl = generateTweetIntentUrl();
			vscode.env.openExternal(vscode.Uri.parse(tweetUrl));
			return;
		case 'Facebook':
			const facebookShareUrl = generateFacebookIntentUrl();
			vscode.env.openExternal(vscode.Uri.parse(facebookShareUrl));
		case 'Email':
			const mailToUrl = generateMailToUrl();
			vscode.env.openExternal(vscode.Uri.parse(mailToUrl));
			return;
		case 'Copy link':
			await vscode.env.clipboard.writeText(MARKETPLACE_URL);
			vscode.window.showInformationMessage('Link copied to clipboard');
			return;
		default:
			return;
	}
};