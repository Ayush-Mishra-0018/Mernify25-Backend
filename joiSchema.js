const Joi = require("joi");


const communityDriveSchemaJoi = Joi.object({
  heading: Joi.string().min(3).max(100).required(),
  description: Joi.string().min(10).max(1000).required(),
  eventDate: Joi.date().required(),
  timeFrom: Joi.date().required(),
  timeTo: Joi.date().greater(Joi.ref("timeFrom")).required(),
  upperLimit: Joi.number().integer().min(1).required(),
});
module.exports = {
  communityDriveSchemaJoi,
};