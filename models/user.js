// set up mongoose
var _     = require('underscore');
var Q = require('q');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var moment = require('moment');

var FB = require('fb');

var bcrypt;
try {
  bcrypt = require('bcrypt');
  console.log('Using BCRYPT normal (might switch to bcrypt-nodejs later, for node v.11');
}catch(err){
  console.log('No bcrypt, using bcrypt-nodejs (gonna fail in comparePassword)');
  console.log(err);
  bcrypt = require('bcrypt-nodejs');
}

var ObjectId = Schema.ObjectId;

var schema = Schema({

  active: { type: Boolean },

  email: { type: String, lowercase: true },
  ptn: String, // 10-digit phone number (not hashed, yet!)

  username: { type: String, default: null, unique: true }, // unique usernames
  username_lowercase: { type: String, default: null, unique: true, lowercase: true }, // unique usernames

  password: { type: String },
  password_default: { type: Boolean },

  role: { type: String, default: "user" },
  admin: { type: Boolean, default: false },

  fb_token: String,
  fb_user: Object,
  fb_friends: Object,

  gplus_token: String,
  gplus_user: Object,

  friends: [
    { type: ObjectId, ref: 'users' }
  ],

  customer: { type: Object }, // stripe customer object, can have many PaymentSource's (cards, atm)
  recipient: { type: Object }, // stripe recipient object

  internal_notes: String, // our internal notes about a person, if they have been vetted

  created: { type: Date },
  modified: { type: Date },

  android: [{
    reg_id: { type: String },
    last: { type: String },
  }],

  // ios: [{
  //   reg_id: { type: String },
  //   last: { type: String },
  // }],

  ios: { type: Array },

  profilephoto: { type: ObjectId, ref: 'media' },
  
  profile: {
    name: { type: String, default: '' },
    bio: { type: String, default: '' },

    background_check: { type: Boolean },
    can_accept_payment: { type: Boolean },

    gender: { type: String, default: '' },
    location: { type: String, default: '' },
    website: { type: String, default: '' },
    picture: { type: String, default: '' }
  },

  resetPasswordToken: String,
  resetPasswordExpires: Date,

  flags: { type: Object } // random flags we'll set per-user (they can change them at-will, basically?)

});

schema.pre('save', function(next) {
  var user = this;

  console.log('preSave');

  if (!user.isModified('password')){
    console.log('!isModified');
    return next();
  }

  console.log('bcrypting');

  bcrypt.genSalt(5, function(err, salt) {
    if (err){
      return next(err);
    }
    bcrypt.hash(user.password, salt, function(err, hash) {
      if (err){
        return next(err);
      }
      user.password = hash;
      next();
    });
  });
});

schema.methods.comparePassword = function(candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
    if (err) return cb(err);
    cb(null, isMatch);
  });
};

var Model = mongoose.model('users', schema);

Model.toProfile = function(User){
  // console.log(User);

  var tmpUser = JSON.parse(JSON.stringify(User));

  var allowed = [
    '_id',
    'profilephoto',
    'profile'
  ];

  var returnObj = {};
  _.each(allowed, function(key){
    if(tmpUser[key] != undefined){
      returnObj[key] = tmpUser[key];
    }
  });

  return returnObj;
};

Model.updateRemote = function(user_ids){
  // Push to mobile that there is an update
  // - currently uses Firebase

  if(!user_ids){
    console.log('no ids to updateRemote');
    return false;
  }

  if(!Array.isArray(user_ids)){
    user_ids = [user_ids];
  }

  user_ids = _.unique(_.map(_.compact(user_ids),function(tmp){ return tmp.toString();}));

  console.log('updating reomte', user_ids);

  user_ids.forEach(function(user_id){
    try {
      user_id = user_id.toString();
      if(user_id.length != 24){
        console.log('invalid user_id in updateRemote', user_id);
        return;
      }

      console.log(config.get('firebase_url') + 'users/' + user_id);

      var userFirebase = new models.Firebase(config.get('firebase_url') + 'users/' + user_id);
      userFirebase.authWithCustomToken(
        models.Firebase.tokenGenerator.createToken({
          uid: 'admin'
        },{
          expires: moment().add(1,'year').unix()
        }), 
        function(){
          userFirebase.set({updated: moment().valueOf()});
        }   
      );

      console.log('SENT to remote');

    }catch(err){
      console.log('Failed user_id updateRemote:', user_id);
      console.log(err);
    }

  });

  return true;

};

Model.signup = function(data, res){

  var email = data.email;

  // Create a default username if one does not exist
  if(!data.username){
    data.username = email.split('@')[0] + getRandomInt(1233,9843).toString();
  }
  data.username = data.username.replace(/[\W_]+/g,"");
  data.username_lowercase = data.username.toLowerCase();

  try {
    var User = new m.User(data);
  } catch(err){
    console.error(err);
    res.status(500);
    return;
  }

  try {

    User.save(function(err, newUser){
      if(err){
        console.log('Failed creating user');
        console.log(err.code);
        if(err.code == 11000){
          // Duplicate key error (username, or email?)
          console.error(err);
          res.status(415);
          res.json({
            complete: false,
            msg: 'duplicate'
          });
          return;
        }
        res.status(415);
        res.json({
          complete: false,
          msg: 'unknown'
        });
        return;
      }

      console.log('User has signed up');
      console.log(newUser);
      console.log(email);

      // send signup emails
      models.email.signup_email(newUser);

      // Build token
      var access_token = models.serializer.stringify([
        User._id, 
        +new Date, 
        'v0.1']);

      // Return to user
      res.json({
        code: 200,
        complete: true,
        email: email,
        _id: newUser._id,
        token: access_token
      });


      // Create default Push Settings for user
      var PushSetting = new m.PushSetting({
        user_id : newUser._id
      });
      PushSetting.save(function(err, newPushSetting){
        if(err){
          console.error('PushSetting error');
          console.error(err);
          return;
        }

        // Saved PushSetting OK
        console.log('Saved PushSetting');

      });

      
      // Accept existing Invites!
      m.Invite.find({email: email, active: true})
      .exec(function(err, invites){
        if(err){
          console.error(err);
          return;
        }

        // For each invite, create a new Friend relationship
        invites.forEach(function(invite){

          var otherUserId = invite.user_id;

          // Create the result!
          var meFriend = new m.Friend({
            user_id: newUser._id,
            friend_id: otherUserId,
            type: 'friend',
            active: true
          });
          meFriend.save(function(err, newFriend){
            if(err){
              console.error(err);
              return;
            }
            console.log('saved meFriend');
          });
          var themFriend = new m.Friend({
            user_id: otherUserId,
            friend_id: newUser._id,
            type: 'friend',
            active: true
          });
          themFriend.save(function(err, newFriend){
            if(err){
              console.error(err);
              return;
            }
            console.log('saved themFriend');
          });

          // Notify the other person!
          m.PushNotification.pushToUser(otherUserId, {
            ios_title: 'New Connection: ' + newUser.profile.name,
            title: 'New Connection',
            message: newUser.profile.name,
            payload: {type: 'new_connection', id: newUser._id, name: newUser.profile.name}
          }, 'new_connection', {});

        });

      });
      


    });
  
  } catch(err2){
    console.log('failed err2 in Model Signup');
    console.error(err2);
    res.status(500);
    res.json(false);
  }
};

Model.updateFacebookFriends = function(User, access_token){

  // Get all Facebook friends
  // - see if any of those are for existing people
  // - check my existing (if one exists) relationship with that person

  var def = Q.defer();

  FB.api('me/friends', {
      appSecret: config.get('fb_app_secret'),
      access_token: access_token
  }, function (friendRes) {
    if(friendRes.error || !friendRes.data){
      console.error('Failed updating user friends1');
      console.error(friendRes.error);
      return;
    }

    console.log('-----Friend Response-----');
    console.log(friendRes);

    var fbFriendIds = _.pluck(friendRes.data, 'id');

    // Check for matching facebook ids from our existing users
    // - every one should match! 
    m.User.find({
      'fb_user.id': {
        '$in' : fbFriendIds
      }
    })
    .exec(function(err, users){
      if(err){
        def.reject();
        return;
      }

      // create (if not exists) internal friend relationship for each facebook friend
      users.forEach(function(otherFriend){
        m.User.createFriend(User, otherFriend);
      });

      def.resolve();

    });

    // User.fb_friends = friendRes.data; // [] array of friend ids
    // User.save(function(err, updatedUser){
    //  if(err){
    //    console.error('Failed updating user friends2');
    //    console.error(err);
    //    return;
    //  }

    //  console.log('updated friends ok');
    // });

  });

  return def.promise;

};

Model.createFriend = function(meUser, otherUser){
  
  var otherUserId = otherUser._id;

  if(meUser._id.toString() == otherUser._id.toString()){
    console.log('friending yourself, that is not allowed');
    return;
  }

  // Relationship already exists?
  m.Friend.findOne({
    user_id: meUser._id,
    friend_id: otherUserId
  })
  .exec(function(err, existingRelationship){
    if(err){
      console.log("Failed finding Friend Relationship if it exists");
      return;
    }

    if(existingRelationship){
      console.log("Friend relationship already exists");
      return;
    }

    // Create the result!
    var meFriend = new m.Friend({
      user_id: meUser._id,
      friend_id: otherUserId,
      type: 'friend',
      active: true
    });
    meFriend.save(function(err, newFriend){
      if(err){
        console.error(err);
        return;
      }
      console.log('saved meFriend');
    });
    var themFriend = new m.Friend({
      user_id: otherUserId,
      friend_id: meUser._id,
      type: 'friend',
      active: true
    });
    themFriend.save(function(err, newFriend){
      if(err){
        console.error(err);
        return;
      }
      console.log('saved themFriend');
    });

    // Notify the other person!
    m.PushNotification.pushToUser(otherUserId, {
      ios_title: 'New Connection: ' + meUser.profile.name,
      title: 'New Connection',
      message: meUser.profile.name,
      payload: {type: 'new_connection', id: meUser._id, name: meUser.profile.name}
    }, 'new_connection', {});

  });

};

exports.Model = Model;

