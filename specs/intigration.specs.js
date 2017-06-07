'use strict';

/* eslint-env node, mocha */
/* eslint no-unused-expressions: 0, arrow-body-style: 0 */

const { expect } = require('chai');
const svc = require('./service');


describe('Handlers registrations are intercepted and altered', () => {
	before(async () => {
		await svc.start();
	});
	describe('GET /prefix/pets/{petId}', () => {
		it('handles petId as nubmer', async () => {
			const res = await svc.test.get('/prefix/pets/42');
			expect(res.statusCode).to.equal(200);
			expect(res.body).to.eql({
				id: 42,
				name: 'Pet 42',
				photoUrls: ['http://pet_42.pic'],
			});
		});

		it('return HTTP 400 when using non number petId', async () => {
			const res = await svc.test.get('/prefix/pets/nedso');
			expect(res.statusCode).to.equal(400);
		});
	});

	describe('body paramters', () => {
		it('handles body paramter', async () => {
			const res = await svc.test.post('/prefix/users', {})
				.send({
					id: 42,
					username: 'user',
				});

			expect(res.statusCode).to.equal(200);
		});

		it('returns HTTP 400 unexpected body is sent', async () => {
			const res = await svc.test.delete('/prefix/users/username')
				.send({ id: 42, username: 'user' });
			expect(res.statusCode).to.equal(400);
		});

		it('allows payload to be optional with required = false', async () => {
			const res = await svc.test.post('/prefix/users');
			expect(res.statusCode).to.equal(200);
		});
	});

	describe('GET /users/login', () => {
		it('corectly validates valid string reply', async () => {
			const res = await svc.test.get('/prefix/users/login');
			expect(res.statusCode).to.equal(200);
			expect(res.text).to.equal('username');
		});

		it('HTTP 500 when returns invalid integer', async () => {
			const res = await svc.test.get('/prefix/users/login?username=invalid');
			expect(res.statusCode).to.equal(500);
		});
	});

	describe('GET /swagger.json', () => {
		it('servers swagger API JSON', async () => {
			const res = await svc.test.get('/prefix/swagger.json');
			expect(res.statusCode).to.equal(200);
			expect(res.body.info.title).to.equal('Test based on Swagger Pet Store');
			expect(res.headers['content-type']).to.contain('application/json');
		});
	});

	describe('anyobject', () => {
		it('can post and return any object', async () => {
			const res = await svc.test.post('/prefix/anyobject')
				.send({ any: 'object' });
			expect(res.statusCode).to.equal(200);
			expect(res.body).to.eql({ any: 'object' });
		});
	});

	describe('object result', () => {
		it('valid response', async () => {
			const res = await svc.test.get('/prefix/object_response');
			expect(res.statusCode).to.equal(200);
			expect(res.body).to.eql({ id: 42 });
		});
		it('invalid response', async () => {
			const res = await svc.test.get('/prefix/object_response?fail=true');
			expect(res.statusCode).to.equal(500);
		});
	});

	describe('array of object result', () => {
		it('valid response', async () => {
			const res = await svc.test.get('/prefix/array_of_object_response');
			expect(res.statusCode).to.equal(200);
			expect(res.body).to.eql([{ id: 42 }, { id: 43 }]);
		});

		it('invalid response', async () => {
			const res = await svc.test.get('/prefix/array_of_object_response?fail=true');
			expect(res.statusCode).to.equal(500);
		});
	});

	describe('empty array of objects with required properties', () => {
		it('accepts an empty array', async () => {
			const res = await svc.test.post('/prefix/empty_array_of_objects_with_required_properties')
				.send({
					id: 'some_id',
					objects: [],
				});
			expect(res.statusCode).to.equal(200);
			expect(res.body).to.eql([]);
		});
	});

	describe('validation_override', () => {
		it('can override single "payload" validation properties', async () => {
			const res = await svc.test.put('/prefix/validation_override/2')
				.send({
					description: 'test',
				});
			expect(res.statusCode).to.equal(200);
		});

		it('other validation keys are unchanged', async () => {
			const res = await svc.test.put('/prefix/validation_override/3')
				.send({ });
			expect(res.statusCode).to.equal(400);
		});

		it('can override "query" validation properties', async () => {
			const res = await svc.test.put('/prefix/validation_override/2?page=test')
				.send({
					name: 'test',
					description: 'test',
				});
			expect(res.statusCode).to.equal(200);
		});

		it('can override "params" validation properties', async () => {
			const res = await svc.test.put('/prefix/validation_override/string')
				.send({
					name: 'test',
					description: 'test',
				});
			expect(res.statusCode).to.equal(200);
		});
	});
});
