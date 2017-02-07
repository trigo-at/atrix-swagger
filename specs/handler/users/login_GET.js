
module.exports = (req, reply) => {
	if (req.query.username === 'invalid') {
		return reply(42);
	}
	return reply('username');
};
