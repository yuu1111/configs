import { TSDocConfiguration, TSDocParser } from "@microsoft/tsdoc";

/**
 * TSDoc解析が報告した構文またはtagの指摘1件
 */
export interface TsdocIssue {
	message: string;
	messageId: string;
	position: number;
}

/**
 * TSDoc解析の結果と検出した引数tagの名前
 */
export interface TsdocResult {
	hasDeprecated: boolean;
	hasReturns: boolean;
	hasSee: boolean;
	issues: TsdocIssue[];
	parameters: string[];
	typeParameters: string[];
}

const parser = new TSDocParser(new TSDocConfiguration());

/**
 * comment本文をTSDocとして解析し、構文の指摘とtagの名前を返す
 *
 * @param text - 解析するTSDoc commentの本文
 * @returns 構文の指摘と検出した引数tagの名前
 */
export function parseTsdoc(text: string): TsdocResult {
	const context = parser.parseString(text);
	return {
		hasDeprecated: context.docComment.deprecatedBlock !== undefined,
		hasReturns: context.docComment.returnsBlock !== undefined,
		hasSee: context.docComment.seeBlocks.length > 0,
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
