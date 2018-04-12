'use strict';

const { isNil, clone } = require('ramda');
const BaseJoi = require('joi');
const DateExtension = require('joi-date-extensions');

const Joi = BaseJoi.extend(DateExtension);

function createStringPropertyValidator(parameter) {
	let schema;
	if (parameter.format) {
		switch (parameter.format) {
			case 'date':
				schema = Joi.date().format('YYYY-MM-DD');
				break;
			case 'date-time':
				schema = Joi.date().iso();
				break;
			case 'uuid':
				schema = Joi.string().guid();
				break;
			default:
				throw new Error(`Unknown format: ${parameter.format}`);
		}
	} else if (parameter.pattern) {
		schema = Joi.string().regex(new RegExp(parameter.pattern));
	} else {
		schema = Joi.string();
	}

	if (parameter.minLength !== undefined) {
		schema = schema.min(parameter.minLength);
	}
	if (parameter.maxLength !== undefined) {
		schema = schema.max(parameter.maxLength);
	}

	if (!parameter.format && !parameter.pattern && parameter.minLength === undefined) {
		schema = schema.allow('');
	}

	return schema;
}

function createNumberPropertyValidator(parameter) {
	let schema;
	switch (parameter.type) {
		case 'integer':
			schema = Joi.number().integer();
			break;
		case 'number':
			schema = Joi.number();
			break;
		default:
			throw new Error(`Invalid type: ${parameter.type}`);
	}

	if (parameter.maximum !== undefined) {
		schema = parameter.exclusiveMaximum ? schema.less(parameter.maximum) : schema.max(parameter.maximum);
	}
	if (parameter.minimum !== undefined) {
		schema = parameter.exclusiveMinimum ? schema.greater(parameter.minimum) : schema.min(parameter.minimum);
	}
	if (parameter.multipleOf !== undefined) {
		schema = schema.multiple(parameter.multipleOf);
	}

	return schema;
}

function createArrayPropertyValidator(parameter) {
	let schema = Joi.array().items(createParameterValidator(parameter.items)); // eslint-disable-line
	// Allow single for query params per default
	if (parameter.in === 'query') {
		schema = schema.single();
	}
	if (parameter.maxItems !== undefined) {
		schema = schema.max(parameter.maxItems);
	}
	if (parameter.minItems !== undefined) {
		schema = schema.min(parameter.minItems);
	}
	if (parameter.uniqueItems) {
		schema = schema.unique();
	}
	return schema;
}

function createSchemaValidator(schema) {
	const cfg = {};
	const workSchema = schema.schema ? schema.schema : schema;
	let schemaObject;
	if (workSchema.properties) {
		Object.keys(workSchema.properties).forEach((key) => {
			let propertySchema = createParameterValidator(workSchema.properties[key]); // eslint-disable-line
			if (workSchema.required && Array.isArray(workSchema.required) && workSchema.required.indexOf(key) !== -1) {
				propertySchema = propertySchema.required();
			}
			cfg[key] = propertySchema;
		});
		schemaObject = Joi.object().keys(cfg);
	} else {
		schemaObject = Joi.object().unknown();
	}

	if (workSchema.description) {
		schemaObject = schemaObject.description(workSchema.description);
	}
	return schemaObject;
}

function createParameterValidator(parameter) {
	let schema;
	if (parameter.schema) {
		schema = createSchemaValidator(parameter.schema);
	} else if (isNil(parameter.type)) {
		schema = Joi.any();
	} else {
		switch (parameter.type) {
			case 'string':
				schema = createStringPropertyValidator(parameter);
				break;
			case 'integer':
			case 'number':
				schema = createNumberPropertyValidator(parameter);
				break;
			case 'boolean':
				schema = Joi.boolean();
				break;
			case 'array':
				schema = createArrayPropertyValidator(parameter);
				break;
			case 'object':
				schema = createSchemaValidator(parameter);
				break;
			default:
				throw new Error(`Unknown type: ${parameter.type} parameter: ${JSON.stringify(parameter, null, 2)}`);
		}
	}
	if (!Array.isArray(parameter.required) && parameter.required) {
		schema = schema.required();
	}
	if (parameter.enum) {
		schema = schema.valid(parameter.enum);
	}
	if (parameter.default) {
		schema = schema.default(parameter.default);
	}
	if (parameter.nullable) {
		schema = schema.allow(null);
	}

	return schema;
}

function createResponseValidator(response) {
	const r = clone(response);
	if (!r.schema) {
		return null;
	}

	return createParameterValidator(r.schema);
}

module.exports = {
	createParameterValidator,
	createResponseValidator,
};
