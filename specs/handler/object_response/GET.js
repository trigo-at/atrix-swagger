module.exports = (req, reply) => {
	if (req.query.fail) {
		return reply({ id: 'asd' });
	}
	return reply({ id: 42 });
};
