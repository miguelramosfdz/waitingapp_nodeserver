// set up mongoose
var mongoose = require('mongoose');
var Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;

var Q = require('q'),
  _ = require('underscore');

var schema = Schema({

  to_user_id: { type: ObjectId, ref: 'users' },
  from_user_id: { type: ObjectId, ref: 'users' },

  in_reply_to: { type: ObjectId, ref: 'messages' },

  read: { type: Boolean, default: false },

  media: [{ type: ObjectId, ref: 'media'}],
  text: { type: String },

  created: { type: Date, default: Date.now },
  modified: { type: Date, default: Date.now }

});

var messageModel = mongoose.model('messages', schema);


messageModel.UserSummary = function(user_id, my_user_id){

  var def = Q.defer();

  // Total messages
  var totalCountDef = Q.defer();
  this.count({
    '$or': [
      {
        from_user_id: user_id,
        to_user_id: my_user_id,
      },
      {
        from_user_id: my_user_id,
        to_user_id: user_id,
      }
    ]
  }, function(err, c){
    if(err){totalCountDef.reject();return;}
    totalCountDef.resolve(c);
  });


  // Unread by me (could also do "unread by them")
  // - count
  var unreadMeCountDef = Q.defer();
  this.count({
    from_user_id: user_id,
    to_user_id: my_user_id,
    read: false
  }, function(err, c){
    if(err){unreadMeCountDef.reject();return;}
    unreadMeCountDef.resolve(c);
  });

  // Get last message
  var lastMessageDef = Q.defer();
  this.findOne({
    '$or': [
      {
        from_user_id: user_id,
        to_user_id: my_user_id,
      },
      {
        from_user_id: my_user_id,
        to_user_id: user_id,
      }
    ]
  }, function(err, lastMessage){
    if(err){lastMessageDef.reject();return;}
    lastMessageDef.resolve(lastMessage);
  });

  // Wait for promises to resolve
  Q.all([totalCountDef.promise, unreadMeCountDef.promise, lastMessageDef.promise])
    .spread(function(total, my_unread, last_message){
      def.resolve({
        total: total,
        unread: my_unread,
        last_message: last_message
      });
    });


  return def.promise;

};

exports.Model = messageModel;
