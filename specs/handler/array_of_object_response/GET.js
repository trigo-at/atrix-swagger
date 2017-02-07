module.exports = (req, reply) => {
	if (req.query.fail) {
		return reply([{ name: 'asd' }, { id: 43 }]);
	}
	return reply([{ id: 42 }, { id: 43 }]);
};
