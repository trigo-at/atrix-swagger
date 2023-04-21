'use strict';

/* eslint-env node, mocha */
/* eslint no-unused-expressions: 0, arrow-body-style: 0 */

const { expect } = require('chai');
const svc = require('./service');

describe('Handler registrations are intercepted and altered', () => {
    before(async () => {
        await svc.start();
    });
    after(async () => {
        await svc.stop();
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
            const res = await svc.test.post('/prefix/users', {}).send({
                id: 42,
                username: 'user',
            });

            expect(res.statusCode).to.equal(200);
        });

        it('returns HTTP 400 unexpected body is sent', async () => {
            const res = await svc.test.delete('/prefix/users/username').send({ id: 42, username: 'user' });
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

    describe('anyobject', () => {
        it('can post and return any object', async () => {
            const res = await svc.test.post('/prefix/anyobject').send({ any: 'object' });
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
            const res = await svc.test.post('/prefix/empty_array_of_objects_with_required_properties').send({
                id: 'some_id',
                objects: [],
            });
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.eql([]);
        });
    });

    describe('nested referenced schema', () => {
        it('validates top object', async () => {
            const res = await svc.test.post('/prefix/nested-referenced-schema').send({ name: 42 });
            expect(res.statusCode).to.equal(400);
        });
        it('validates top -> nested object', async () => {
            const res = await svc.test
                .post('/prefix/nested-referenced-schema')
                .send({ name: 'test', nested: { name: 42 } });
            expect(res.statusCode).to.equal(400);
            const res2 = await svc.test.post('/prefix/nested-referenced-schema').send({ name: 'test', nested: {} });
            expect(res2.statusCode).to.equal(400);
        });
        it('validates top -> nested -> nested  object', async () => {
            const res = await svc.test
                .post('/prefix/nested-referenced-schema')
                .send({ name: 'test', nested: { name: 'nested', nested: { name: 42 } } });
            expect(res.statusCode).to.equal(400);
            const res2 = await svc.test
                .post('/prefix/nested-referenced-schema')
                .send({ name: 'test', nested: { name: 'nested', nested: {} } });
            expect(res2.statusCode).to.equal(400);
        });
    });

    describe('header validation', () => {
        it('validates required headers', async () => {
            let res = await svc.test.get('/prefix/supports-header-validation').set({ 'x-test-header-optional': 'test' });
            expect(res.statusCode).to.equal(400);
            expect(res.body.message).to.contain('Invalid request headers input');
            res = await svc.test.get('/prefix/supports-header-validation').set({ 'x-test-header-required': 'test' });
            expect(res.statusCode).to.equal(200);
        });
        it('validates header type', async () => {
            const res = await svc.test
                .get('/prefix/supports-header-validation')
                .set({ 'x-test-header-required': 'test', 'x-test-header-optional': 'foobar' });
            expect(res.statusCode).to.equal(400);
            expect(res.body.message).to.contain('Invalid request headers input');
        });
        it('ingores unknown headers', async () => {
            const res = await svc.test
                .get('/prefix/supports-header-validation')
                .set({ 'x-test-header-required': 'test', 'x-test-header-asdf': 'foo' });
            expect(res.statusCode).to.equal(200);
        });
        it('unknown headers are available in req.headers', async () => {
            const res = await svc.test
                .get('/prefix/supports-header-validation')
                .set({ 'x-test-header-required': 'test', 'x-test-header-asdf': 'foo' });
            expect(res.statusCode).to.equal(200);
            expect(res.body.headers['x-test-header-asdf']).to.eql('foo');
        });
    });

    describe('typeless parameters/schemas', () => {
        ['test', 0, true].forEach(v => {
            it(`can omit type in main parameters list send ?typless=${typeof v === 'object' ? JSON.stringify(v) : v
                }`, async () => {
                    const res = await svc.test.get(`/prefix/typeless?typeless=${v}`);
                    expect(res.statusCode).to.eql(200);
                });
        });

        ['test', 0, { test: 'obj' }].forEach(v => {
            it(`can omit type in body schema send ${typeof v === 'object' ? JSON.stringify(v) : v}`, async () => {
                const res = await svc.test.post('/prefix/typeless').send(v);
                expect(res.statusCode).to.eql(200);
            });
        });

        ['test', 0, { test: 'obj' }].forEach(v => {
            it(`can omit type in body schema send ${typeof v === 'object' ? JSON.stringify(v) : v}`, async () => {
                const res = await svc.test.put('/prefix/typeless').send({ typeless: v, 'typeless-required': 'sdf' });
                expect(res.statusCode).to.eql(200);
            });

            it(`Typless parameters ca be marked as required. Sending ${typeof v === 'object' ? JSON.stringify(v) : v
                }`, async () => {
                    const res = await svc.test.put('/prefix/typeless').send({ typeless: v });
                    expect(res.statusCode).to.eql(400);
                    expect(res.body.message).to.contain('Invalid request payload input');
                });
        });
    });

    describe('GET /prefix/swagger.json', () => {
        it('servers swagger API JSON', async () => {
            const token = jwt.sign({ foo: 'bar' }, 'changeme');

            const res = await svc.test.get('/prefix/swagger.json').set({ Authorization: `Bearer ${token}` });
            expect(res.statusCode).to.equal(200);
            expect(res.body.info.title).to.equal('Test based on Swagger Pet Store');
            expect(res.headers['content-type']).to.contain('application/json');
        });

        it('Secured swagger API JSON', async () => {
            const res = await svc.test.get('/prefix/swagger.json');
            expect(res.statusCode).to.equal(401);
        });
    });
});
