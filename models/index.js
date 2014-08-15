
// Mongoose
var mongoose = require("mongoose"),
	mongoDbUrl = config.get('mongo_string');

// mongoose.set('debug', true);

// mongoose.connection.on('error', function (err) {
//   console.log('MONGO ERROR');
// });
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

// exports.Action = require('./action').actionModel;
// exports.Feed = require('./feed').feedModel;
// exports.Game = require('./game').gameModel;
// exports.GameStar = require('./game_star').gameStarModel;
// exports.Log = require('./log').logModel;
exports.Media = require('./media').mediaModel;
exports.Message = require('./message').Model;

exports.PushNotification = require('./push_notification').pushModel;
exports.PushSetting = require('./push_setting').pushSettingModel;
exports.PushSettingMod = require('./push_setting_mod').pushSettingModModel;

exports.RelationshipCode = require('./relationship_code').relationshipModel;

// exports.Player = require('./player').playerModel;
// exports.Notification = require('./notification').notificationModel;
// exports.PushNotification = require('./push_notification').pushModel;
// exports.RelationshipCode = require('./relationship_code').relationshipModel;
// exports.Sport = require('./sport').sportModel;
// exports.Story = require('./story').storyModel;
// exports.StoryTemplate = require('./story_template').storyTemplateModel;
exports.User = require('./user').userModel;