'use strict';

module.exports = (req, reply) => reply({
	id: req.params.petId,
	name: 'Pet 42',
	photoUrls: ['http://pet_42.pic'],
});

