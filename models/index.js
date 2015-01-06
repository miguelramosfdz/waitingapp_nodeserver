
// Mongoose
var mongoose = require("mongoose"),
	mongoDbUrl = config.get('mongo_string');

// mongoose.set('debug', true);

mongoose.connection.on('error', function (err) {
  console.log('MONGO ERROR');
  console.error(err);
});
// mongoose.connection.on('connected', function (err) {
//   console.log('MONGO connect');
// });
// mongoose.connection.on('disconnected', function (err) {
//   console.log('MONGO disconnected');
// });
// mongoose.connection.on('open', function (err) {
//   console.log('MONGO open');
// });
// mongoose.connection.on('closed', function (err) {
//   console.log('MONGO closed');
// });
// mongoose.connection.on('reconnected', function (err) {
//   console.log('MONGO reconnected');
// });

// Connect to Mongo DB
mongoose.connect(mongoDbUrl, function(err){
	if(err) console.log('MongoDB: connection error -> ' + err);
    else console.log('MongoDB: successfully connected');
});


exports.Friend = require('./friend').Model;

exports.Invite = require('./invite').Model;

exports.KeyValue = require('./key_value').Model;

exports.Media = require('./media').Model;
exports.Message = require('./message').Model;

exports.PaymentCharge = require('./payment_charge').Model; // not used yet
exports.PaymentSource = require('./payment_source').Model;
exports.PushNotification = require('./push_notification').Model;
exports.PushSetting = require('./push_setting').Model;
exports.PushSettingMod = require('./push_setting_mod').Model;
exports.RelationshipCode = require('./relationship_code').Model;
exports.User = require('./user').Model;