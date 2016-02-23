/**
 * Convert stream of AST nodes to strings.
 *
 * @module
 */

var tokenize = require('glsl-tokenizer/string');
var parse = require('glsl-parser/direct');
var GLSL = require('./');
var Transform = require('stream').Transform;
var inherits = require('inherits');

function GlslJsStream (options) {
	if (!(this instanceof GlslJsStream)) return new GlslJsStream(options);

	Transform.call(this, {
		objectMode: true
	});

	//actual version of tree
	this.tree = null;

	//actual version of code
	this.source = '';

	this.on('data', function (data) {
		this.source += data + '\n';
	});

	//glsl compiler
	this.glsl = GLSL(options);
};

inherits(GlslJsStream, Transform);


// glsl-parser streams data for each token from the glsl-tokenizer,
// it generates lots of duplicated ASTs, which does not make any sense in the output.
// So the satisfactory behaviour here is to render each statement in turn.
GlslJsStream.prototype._transform = function (chunk, enc, cb) {
	//if string passed - tokenize and parse it
	if (typeof chunk === 'string') {
		//FIXME: there is a problem of invalid input chunks; gotta wait till some sensible thing is accumulated and then parse.
		var tree = parse(tokenize(chunk));
		cb(null, this.glsl.stringify(tree));

		this.tree = tree;
	}
	//if tree - compile the tree
	else {
		//if function statements expected - wait for stmtlist of it to render fully
		if (this._isFunctionMode) {
			if (chunk.type === 'function') {
				this._isFunctionMode = false;
			}
			cb(null);
		}

		else {
			if (chunk.type === 'stmt')	{
				cb(null, this.glsl.stringify(chunk));
			}
			else {
				//detect entering function mode to avoid reacting on stmts
				if (chunk.type === 'functionargs') {
					this._isFunctionMode = true;
				}
				//save last stmtlist to pass to the end
				else if (chunk.type === 'stmtlist') {
					this.tree = chunk;
				}
				cb(null);
			}
		}
	}
};

module.exports = GlslJsStream;