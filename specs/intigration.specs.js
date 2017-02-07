'use strict';

/* eslint-env node, mocha */
/* eslint no-unused-expressions: 0, arrow-body-style: 0 */

const { expect } = require('chai');
const svc = require('./service');


describe('Handlers registrations are intercepted and altered', () => {
	before(async () => {
		await svc.start();
	});
	describe('GET /pets/{petId}', () => {
		it('handles petId as nubmer', async () => {
			const res = await svc.test.get('/pets/42');
			expect(res.statusCode).to.equal(200);
			expect(res.body).to.eql({
				id: 42,
				name: 'Pet 42',
				photoUrls: ['http://pet_42.pic'],
			});
		});

		it('return HTTP 400 when using non number petId', async () => {
			const res = await svc.test.get('/pets/nedso');
			expect(res.statusCode).to.equal(400);
		});
	});

	describe('body paramters', () => {
		it('handles body paramter', async () => {
			const res = await svc.test.post('/users', {})
				.send({
					id: 42,
					username: 'user',
				});

			expect(res.statusCode).to.equal(200);
		});

		it('returns HTTP 400 unexpected body is sent', async () => {
			const res = await svc.test.delete('/users/username')
				.send({ id: 42, username: 'user' });
			expect(res.statusCode).to.equal(400);
		});
	});

	describe('GET /users/login', () => {
		it('corectly validates valid string reply', async () => {
			const res = await svc.test.get('/users/login');
			expect(res.statusCode).to.equal(200);
			expect(res.text).to.equal('username');
		});

		it('HTTP 500 when returns invalid integer', async () => {
			const res = await svc.test.get('/users/login?username=invalid');
			expect(res.statusCode).to.equal(500);
		});
	});

	describe('GET /swagger.json', () => {
		it('servers swagger API JSON', async () => {
			const res = await svc.test.get('/swagger.json');
			expect(res.statusCode).to.equal(200);
			expect(res.body.info.title).to.equal('Test based on Swagger Pet Store');
			expect(res.headers['content-type']).to.contain('application/json');
		});
	});

	describe('anyobject', () => {
		it('can post and return any object', async () => {
			const res = await svc.test.post('/anyobject')
				.send({ any: 'object' });
			expect(res.statusCode).to.equal(200);
			expect(res.body).to.eql({ any: 'object' });
		});
	});

	describe('object result', () => {
		it('valid response', async () => {
			const res = await svc.test.get('/object_response');
			expect(res.statusCode).to.equal(200);
			expect(res.body).to.eql({ id: 42 });
		});
		it('invalid response', async () => {
			const res = await svc.test.get('/object_response?fail=true');
			expect(res.statusCode).to.equal(500);
		});
	});

	describe('array of object result', () => {
		it('valid response', async () => {
			const res = await svc.test.get('/array_of_object_response');
			expect(res.statusCode).to.equal(200);
			expect(res.body).to.eql([{ id: 42 }, { id: 43 }]);
		});

		it('invalid response', async () => {
			const res = await svc.test.get('/array_of_object_response?fail=true');
			expect(res.statusCode).to.equal(500);
		});
	});
});
