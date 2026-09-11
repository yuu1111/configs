import { TSDocConfiguration, TSDocParser } from "@microsoft/tsdoc";

export interface TsdocIssue {
	message: string;
	messageId: string;
	position: number;
}

export interface TsdocResult {
	issues: TsdocIssue[];
	parameters: string[];
	typeParameters: string[];
}

const parser = new TSDocParser(new TSDocConfiguration());

/** comment本文をTSDocとして解析し、構文の指摘とtagの名前を返す */
export function parseTsdoc(text: string): TsdocResult {
	const context = parser.parseString(text);
	return {
		issues: context.log.messages.map((message) => ({
			message: message.unformattedText,
			messageId: message.messageId,
			position: message.textRange.pos,
		})),
		parameters: context.docComment.params.blocks.map(
			(block) => block.parameterName,
		),
		typeParameters: context.docComment.typeParams.blocks.map(
			(block) => block.parameterName,
		),
	};
}
