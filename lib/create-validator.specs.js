'use strict';

/* eslint-env node, mocha */
/* eslint no-unused-expressions: 0, arrow-body-style: 0 */

const { expect } = require('chai');
const Joi = require('joi');
const { createParameterValidator } = require('./create-validator');
const uuid = require('uuid');

describe('createParameterValidation', () => {
	function getSchema(def) {
		const config = {};
		config[def.name] = createParameterValidator(def);
		const schema = Joi.object(config);
		return {
			schema,
			ok: (obj) => {
				Joi.assert(obj, schema);
			},
			fail: (obj, msg) => {
				try {
					expect(() => Joi.assert(obj, schema)).to.throw(Error, msg);
				} catch (e) {
					console.error(e); // eslint-disable-line
					throw e;
				}
			},
		};
	}

	describe('"boolean" properties', () => {
		it('creates boolean validator', () => {
			const schema = getSchema({
				name: 'test',
				type: 'boolean',
			});

			schema.ok({ test: true });
			schema.ok({ test: false });
			schema.fail({ test: 0 });
			schema.fail({ test: 1 });
		});
	});

	describe('attribute "required"', () => {
		it('make property required', () => {
			const schema = getSchema({
				name: 'test',
				type: 'string',
				required: true,
			});
			schema.ok({ test: 'true' });
			schema.fail({});
		});
	});

	it('handles attribute "default"', () => {
		const schema = getSchema({
			name: 'test',
			type: 'string',
			default: 'uuid',
		});

		const parsedValue = Joi.validate({}, schema.schema);
		expect(parsedValue.value.test).to.equal('uuid');
	});

	describe('handles "enum" attribute', () => {
		it('string property', () => {
			const schema = getSchema({
				name: 'test',
				type: 'string',
				enum: ['v1', 'v2', 'v3'],
			});
			schema.ok({ test: 'v1' });
			schema.ok({ test: 'v2' });
			schema.ok({ test: 'v3' });
			schema.fail({ test: 'adg' }, /must be one of/);
		});
		it('number property', () => {
			const schema = getSchema({
				name: 'test',
				type: 'number',
				enum: [42, 21, null],
			});
			schema.ok({ test: 42 });
			schema.ok({ test: 21 });
			schema.ok({ test: null });
			schema.fail({ test: 32 }, /must be one of/);
		});
	});

	describe('"number" properties & options', () => {
		it('creates integer validator', () => {
			const schema = getSchema({
				name: 'test',
				type: 'integer',
			});
			schema.ok({ test: 100 });
			schema.fail({ test: 'asd' }, /must be a number/);
			schema.fail({ test: 1.2 }, /must be an integer/);
		});

		it('creates number validator', () => {
			const schema = getSchema({
				name: 'test',
				type: 'number',
			});

			schema.ok({ test: 100 });
			schema.ok({ test: -100.3 });
			schema.fail({ test: 'asd' }, /must be a number/);
			schema.fail({ test: false }, /must be a number/);
		});

		it('handles "maximum" attribute', () => {
			const schema = getSchema({
				name: 'test',
				type: 'number',
				maximum: 42,
			});

			schema.ok({ test: 12 });
			schema.ok({ test: -100 });
			schema.ok({ test: 42 });
			schema.fail({ test: 43 }, /must be less than or equal to/);
			schema.fail({ test: 42.00001 }, /must be less than or equal to/);
		});
		it('handles "exclusiveMaximum" attribute', () => {
			const schema = getSchema({
				name: 'test',
				type: 'number',
				maximum: 42,
				exclusiveMaximum: true,
			});

			schema.ok({ test: 12 });
			schema.ok({ test: -100 });
			schema.fail({ test: 42 }, /must be less than 42/);
			schema.fail({ test: 42.00001 }, /must be less than 42/);
		});

		it('handles "minimum" attribute', () => {
			const schema = getSchema({
				name: 'test',
				type: 'number',
				minimum: 42,
			});

			schema.ok({ test: 1122 });
			schema.ok({ test: 1030 });
			schema.ok({ test: 42 });
			schema.fail({ test: -14 }, /must be larger than or equal/);
			schema.fail({ test: 41.99999999 }, /must be larger than or equal/);
		});

		it('handles "exclusiveMinimum" attibute', () => {
			const schema = getSchema({
				name: 'test',
				type: 'number',
				minimum: 42,
				exclusiveMinimum: true,
			});

			schema.ok({ test: 1122 });
			schema.ok({ test: 1030 });
			schema.fail({ test: 42 }, /must be greater than 42/);
			schema.fail({ test: 41.99999999 }, /must be greater than 42/);
		});

		it('handles "multipleOf" attribute', () => {
			const schema = getSchema({
				name: 'test',
				type: 'number',
				multipleOf: 5,
			});

			schema.ok({ test: 0 });
			schema.ok({ test: 5 });
			schema.ok({ test: 20 });
			schema.fail({ test: 21 }, /must be a multiple of 5/);
		});

		it('handles attribute "default"', () => {
			const schema = getSchema({
				name: 'test',
				type: 'number',
				default: 5,
			});

			const parsedValue = Joi.validate({}, schema.schema);
			expect(parsedValue.value.test).to.equal(5);
		});
	});

	describe('"string" properties & options', () => {
		it('creates string validator', () => {
			const schema = getSchema({
				name: 'test',
				type: 'string',
			});

			schema.ok({ test: '100' });
			schema.ok({ test: 'asdgasg' });
			schema.fail({ test: 12 }, /must be a string/);
			schema.fail({ test: false }, /must be a string/);
		});

		it('creates string validator allows empty strings', () => {
			const schema = getSchema({
				name: 'test',
				type: 'string',
			});

			schema.ok({ test: '' });
		});

		it('handles "pattern" attribute', () => {
			const schema = getSchema({
				name: 'test',
				type: 'string',
				pattern: '^start',
			});
			schema.ok({ test: 'start' });
			schema.fail({ test: 'notstart' });
		});

		it('handles "minLength" attribute', () => {
			const schema = getSchema({
				name: 'test',
				type: 'string',
				minLength: 4,
			});
			schema.ok({ test: 'start' });
			schema.fail({ test: 'i12' }, /length must be at least 4 character/);
		});

		it('handles "maxLength" attribute', () => {
			const schema = getSchema({
				name: 'test',
				type: 'string',
				maxLength: 4,
			});
			schema.ok({ test: 'stat' });
			schema.fail({ test: 'i12as' }, /length must be less than or equal to 4 characters/);
		});


		it('handles attribute "format=date"', () => {
			const schema = getSchema({
				name: 'test',
				type: 'string',
				format: 'date',
			});

			schema.ok({ test: '1980-05-14' });
			schema.fail({ test: new Date().toISOString() });
		});

		it('handles attribute "format=date-time"', () => {
			const schema = getSchema({
				name: 'test',
				type: 'string',
				format: 'date-time',
			});

			schema.ok({ test: new Date().toISOString() });
			schema.ok({ test: new Date() });
			schema.fail({ test: 'ka date' });
		});

		it('handles attribute "format=uuid"', () => {
			const schema = getSchema({
				name: 'test',
				type: 'string',
				format: 'uuid',
			});

			schema.ok({ test: uuid() });
			schema.fail({ test: 'ka date' });
		});
	});

	describe('array properties', () => {
		it('handle "string" array', () => {
			const schema = getSchema({
				name: 'test',
				type: 'array',
				items: {
					type: 'string',
				},
			});

			schema.ok({ test: [] });
			schema.ok({ test: ['1', '2', '1asf'] });
			schema.fail({ test: 'ka date' }, /must be an array/);
			schema.fail({ test: [1, 2] });
		});

		it('handle "number" array', () => {
			const schema = getSchema({
				name: 'test',
				type: 'array',
				items: {
					type: 'number',
				},
			});

			schema.ok({ test: [] });
			schema.ok({ test: [1, 2, 12.2] });
			schema.fail({ test: 'ka date' }, /must be an array/);
			schema.fail({ test: ['1s', 2] });
		});

		it('handles "minItems" attribute', () => {
			const schema = getSchema({
				name: 'test',
				type: 'array',
				items: {
					type: 'number',
				},
				minItems: 3,
			});

			schema.ok({ test: [1, 213, 412, 12] });
			schema.ok({ test: [1, 2, 12.2] });
			schema.fail({ test: [2] }, /must contain at least 3 items/);
		});

		it('handles "maxItems" attribute', () => {
			const schema = getSchema({
				name: 'test',
				type: 'array',
				items: {
					type: 'number',
				},
				maxItems: 3,
			});

			schema.ok({ test: [213, 412, 12] });
			schema.ok({ test: [1] });
			schema.fail({ test: [1, 2, 3, 4, 5] }, /must contain less than or equal to 3 items/);
		});

		it('handles "uniqueItems" attribute', () => {
			const schema = getSchema({
				name: 'test',
				type: 'array',
				items: {
					type: 'number',
				},
				uniqueItems: true,
			});

			schema.ok({ test: [213, 412, 12] });
			schema.ok({ test: [1] });
			schema.fail({ test: [1, 2, 3, 1, 5] }, /contains a duplicate value/);
		});
	});

	describe('"object" properties', () => {
		it('primitive type property', () => {
			const schema = getSchema({
				name: 'test',
				type: 'object',
				description: 'desc',
				properties: {
					name: {
						type: 'string',
					},
				},
			});

			schema.ok({ test: { name: 'AtrixSwagger' } });
			schema.ok({ test: {} });
			schema.fail({ test: 0 });
		});

		it('object type property', () => {
			const schema = getSchema({
				name: 'test',
				type: 'object',
				description: 'desc',
				properties: {
					name: {
						type: 'object',
						description: 'test nested obj',
						properties: {
							id: {
								type: 'number',
								minimum: 0,
							},
						},
					},
				},
			});

			schema.ok({ test: { name: { id: 12 } } });
			schema.ok({ test: {} });
			schema.fail({ test: { name: { id: -1 } } }, /must be larger than or equal to 0/);
		});

		it('"required" property', () => {
			const schema = getSchema({
				name: 'test',
				type: 'object',
				description: 'desc',
				properties: {
					name: {
						type: 'string',
					},
				},
				required: ['name'],
			});

			schema.ok({ test: { name: 'AtrixSwagger' } });
			schema.fail({ test: {} }, /is required/);
			schema.fail({ test: 0 });
		});

		it('"description" property', () => {
			const schema = getSchema({
				name: 'test',
				type: 'object',
				description: 'desc',
				properties: {
				},
				required: ['name'],
			});

			expect(schema.schema._inner.children[0].schema._description).to.equal('desc'); // eslint-disable-line
		});
	});
});
