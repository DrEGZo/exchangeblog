const functions = require('firebase-functions');
const admin = require('firebase-admin');
const serviceAccount = require("./adminsdk.json");
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const url = require('url');
const nodemailer = require('nodemailer');

const app = express();

//admin.initializeApp(functions.config().firebase);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://exchange-blog.firebaseio.com"
});

const db = admin.firestore();

app.use(bodyParser.json());

var dbUser = {};
var dbMedia = {};
var dbComments = {};
var dbCommentReplies = {};
var dbBlogentries = {};
var dbStatusUpdates = {};

db.collection('User').onSnapshot(snapshot => {
  snapshot.forEach(doc => {
    dbUser[doc.id] = doc.data();
  });
});
db.collection('Media').onSnapshot(snapshot => {
  snapshot.forEach(doc => {
    dbMedia[doc.id] = doc.data();
  });
});
db.collection('Comments').onSnapshot(snapshot => {
  snapshot.forEach(doc => {
    dbComments[doc.id] = doc.data();
  });
});
db.collection('CommentReplies').onSnapshot(snapshot => {
  snapshot.forEach(doc => {
    dbCommentReplies[doc.id] = doc.data();
  });
});
db.collection('Blogentries').onSnapshot(snapshot => {
  snapshot.forEach(doc => {
    dbBlogentries[doc.id] = doc.data();
  });
});
db.collection('StatusUpdates').onSnapshot(snapshot => {
  snapshot.forEach(doc => {
    dbStatusUpdates[doc.id] = doc.data();
  });
});


app.get('/lorem', (req,res) => {
  res.send('Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.');
});

app.post('/getHomeContent', (req,res) => {
  var bloglist = [];
  for (var blogkey in dbBlogentries) {
    bloglist.push({
      id: blogkey,
      title: dbBlogentries[blogkey]['Title_' + req.body.lang],
      intro: dbBlogentries[blogkey]['Intro_' + req.body.lang],
      location: dbMedia[dbBlogentries[blogkey].Thumbnail].Location,
      upload: dbBlogentries[blogkey].Upload.true
    })
  }
  console.log(JSON.stringify(dbBlogentries))
  console.log(JSON.stringify(bloglist))
  bloglist.sort((a,b) => {
    if (a.upload > b.upload) return 1;
    if (a.upload < b.upload) return -1;
    return 0;
  });
  var result = [];
  for (var i = 0; i < 3 && i < bloglist.length; i++) {
    result.push(bloglist[i]);
  }
  console.log(JSON.stringify(result))
  res.json(result);
})

app.post('/getBlogList', (req,res) => {
  auth(req.body.idToken)
    .then((uid) => {
      var rank = dbUser[uid].Rank;
      var idlist = [];
      for (var blogkey in dbBlogentries) {
        var hasPermission = dbBlogentries[blogkey].Visibility.indexOf(rank) != -1;
        var isShown = new Date().getTime() > new Date(dbBlogentries[blogkey].Upload.release).getTime();
        var yearMatches = new Date(dbBlogentries[blogkey].Upload.true).getFullYear() == req.body.year;
        var monthMatches = new Date(dbBlogentries[blogkey].Upload.true).getMonth() == req.body.month;
        if (hasPermission && isShown && yearMatches && monthMatches) idlist.push(blogkey);
      }
      idlist.sort((a, b) => {
        if (dbBlogentries[a].Upload.true.getTime() < dbBlogentries[b].Upload.true.getTime()) return 1;
        if (dbBlogentries[a].Upload.true.getTime() > dbBlogentries[b].Upload.true.getTime()) return -1;
        return 0;
      });
      var result = [];
      for (var i = 0; i < idlist.length; i++) {
        if (dbBlogentries[idlist[i]].Visibility.indexOf(dbUser[uid].Rank) != -1) result.push({
          id: idlist[i],
          thumbnail: dbMedia[dbBlogentries[idlist[i]].Thumbnail].Location,
          title: dbBlogentries[idlist[i]]['Title_' + req.body.lang],
          intro: dbBlogentries[idlist[i]]['Intro_' + req.body.lang],
          upload: dbBlogentries[idlist[i]].Upload.release
        });
      }
      res.json(result);
    }).catch((err) => {
      res.status(500);
      admin.auth().verifyIdToken(req.body.idToken).catch(() => {
        res.status(401);
      }).then(() => auth(req.body.idToken)).catch(() => {
        res.status(403);
      }).then(() => { res.end(err) });
    });
});

app.post('/getMediaList', (req,res) => {
  auth(req.body.idToken)
    .then((uid) => {
      var rank = dbUser[uid].Rank;
      var idlist = [];
      for (var mediakey in dbMedia) {
        var hasPermission = dbMedia[mediakey].Visibility.indexOf(rank) != -1;
        var isShown = new Date().getTime() > new Date(dbMedia[mediakey].Upload.release).getTime();
        var yearMatches = new Date(dbMedia[mediakey].Upload.true).getFullYear() == req.body.year;
        var monthMatches = new Date(dbMedia[mediakey].Upload.true).getMonth() == req.body.month;
        if (hasPermission && isShown && yearMatches && monthMatches) idlist.push(mediakey);
      }
      res.json(evaluateIdList(idlist,uid,req.body.lang));
    }).catch((err) => {
      res.status(500);
      admin.auth().verifyIdToken(req.body.idToken).catch(() => {
        res.status(401);
      }).then(() => auth(req.body.idToken)).catch(() => {
        res.status(403);
      }).then(() => { res.end(err) });
    });
});

app.post('/getGalleryData', (req,res) => {
  auth(req.body.idToken)
    .then((uid) => {
      res.json(evaluateIdList(req.body.list, uid, req.body.lang));
    }).catch((err) => {
      res.status(500);
      admin.auth().verifyIdToken(req.body.idToken).catch(() => {
        res.status(401);
      }).then(() => auth(req.body.idToken)).catch(() => {
        res.status(403);
      }).then(() => { res.end(err) });
    });
});

app.post('/getMediaData', (req,res) => {
  auth(req.body.idToken)
    .then((uid) => {
      if (dbMedia[req.body.mid].Visibility.indexOf(dbUser[uid].Rank) != -1) {
        result = getMetadata('media', req.body.mid, uid);
        result.description = dbMedia[req.body.mid]['Description_' + req.body.lang];
        res.json(result);
      } else {
        res.status(403).end();
      }
    }).catch((err) => {
      res.status(500);
      admin.auth().verifyIdToken(req.body.idToken).catch(() => {
        res.status(401);
      }).then(() => auth(req.body.idToken)).catch(() => {
        res.status(403);
      }).then(() => { res.end(err) });
    });
})

app.post('/getBlogData', (req, res) => {
  var blogid = req.body.blogid;
  auth(req.body.idToken)
    .then((uid) => {
      if (blogid in dbBlogentries) {
        var hasPermission = dbBlogentries[blogid].Visibility.indexOf(dbUser[uid].Rank) != -1;
        var isShown = new Date().getTime() > new Date(dbBlogentries[blogid].Upload.release).getTime();
        if (hasPermission && isShown) {
          res.json(getMetadata('blogpost',blogid,uid,req.body.lang));
        } else if (isShown) {
          res.status(403).end();
        } else {
          res.status(404).end();
        }
      } else {
        res.status(404).end();
      }
    }).catch((err) => {
      res.status(500);
      admin.auth().verifyIdToken(req.body.idToken).catch(() => {
        res.status(401);
      }).then(() => auth(req.body.idToken)).catch(() => {
        res.status(403);
      }).then(() => { res.end(err) });
    });
});

app.post('/auth', (req,res) => {
  auth(req.body.idToken)
    .then(() => {
      res.end();
    }).catch((err) => {
      res.status(500);
      admin.auth().verifyIdToken(req.body.idToken).catch(() => {
        res.status(401);
      }).then(() => auth(req.body.idToken)).catch(() => {
        res.status(403);
      }).then(() => { res.end(err) });
    });
});

app.post('/addComment', (req, res) => {
  var reference;
  if (req.body.containerTyp == 'blog') {
    reference = 'Blogentries';
  } else if (req.body.containerTyp == 'media') {
    reference = 'Media';
  } else if (req.body.containerTyp == 'status') {
    reference = 'StatusUpdates';
  } else if (req.body.containerTyp == 'comment') {
    reference = 'Comments';
  }
  var databaseKey = createNewDatabaseKey();
  auth(req.body.idToken)
    .then((uid) => {
      var mainTyp = req.body.mainTyp;
      var mainId = req.body.mainId;
      if ((() => {
        if (mainTyp == 'blog') {
          return dbBlogentries[mainId].Visibility.indexOf(dbUser[uid].Rank) == -1;
        } else if (mainTyp == 'media') {
          return dbMedia[mainId].Visibility.indexOf(dbUser[uid].Rank) == -1;
        } else if (mainTyp == 'status') {
          return dbStatusUpdates[mainId].Visibility.indexOf(dbUser[uid].Rank) == -1;
        } else { return true }
      })()) {
        res.status(403).end();
      } else {
        (() => new Promise((resolve,reject) => { resolve() }))().then(() => {
          if (req.body.containerTyp == 'comment') {
            return db.collection('CommentReplies').doc(databaseKey).set({
              author: uid,
              content: escapeHtml(req.body.content),
              time: new Date(),
              source: { typ: reference, id: req.body.containerId }
            });
          } else {
            return db.collection('Comments').doc(databaseKey).set({
              author: uid,
              content: escapeHtml(req.body.content),
              replies: [],
              time: new Date(),
              source: { typ: reference, id: req.body.containerId }
            });
          }
        }).then(() => {
          var containerId = req.body.containerId;
          if (req.body.containerTyp == 'comment') {
            dbComments[containerId].replies.push(databaseKey);
            db.collection('Comments').doc(containerId).update({
              replies: dbComments[containerId].replies
            });
          } else if (req.body.containerTyp == 'media') {
            dbMedia[containerId].Comments.push(databaseKey);
            db.collection('Media').doc(containerId).update({
              Comments: dbMedia[containerId].Comments
            });
          } else if (req.body.containerTyp == 'blog') {
            dbBlogentries[containerId].Comments.push(databaseKey);
            db.collection('Blogentries').doc(containerId).update({
              Comments: dbBlogentries[containerId].Comments
            });
          } else if (req.body.containerTyp == 'status') {
            dbStatusUpdates[containerId].Comments.push(databaseKey);
            db.collection('StatusUpdates').doc(containerId).update({
              Comments: dbStatusUpdates[containerId].Comments
            });
          }
          res.end();
        });
      }
    }).catch((err) => {
      res.status(500);
      admin.auth().verifyIdToken(req.body.idToken).catch(() => {
        res.status(401);
      }).then(() => auth(req.body.idToken)).catch(() => {
        res.status(403);
      }).then(() => { res.end(err) });
    });
});

/*app.post('/replyToComment', (req,res) => {
  auth(req.body.idToken)
    .then((uid) => {
      return new Promise((resolve, reject) => {
        var directory;
        var coll;
        if (req.body.typ == 'media') {
          directory = dbMedia;
        } else if (req.body.typ == 'blog') {
          directory = dbBlogentries;
        }
        if (uid in dbUser && req.body.target in directory) {
          if (directory[req.body.target].Visibility.indexOf(dbUser[uid].Rank) != -1) {
            resolve(uid);
            return;
          }
        }
        reject();
      });
    }).then((uid) => {
      return db.collection('CommentReplies').add({
        author: uid,
        content: escapeHtml(req.body.content),
        time: new Date()
      });
    }).then((id) => {
      id = id.id;
      dbComments[req.body.comtarget].replies.push(id);
      db.collection('Comments').doc(req.body.comtarget).update({
        replies: dbComments[req.body.comtarget].replies
      });
      res.end();
    }).catch(() => {
      res.status(403).end();
    });
});*/

app.post('/deleteComment', (req, res) => {
  auth(req.body.idToken)
    .then((uid) => {
      var id = req.body.id;
      var typ = req.body.typ;
      var source = req.body.source;
      if (typ == 'blog') {
        if (dbComments[id].author == uid || dbUser[uid].Rank == 'admin') {
          var index = dbBlogentries[source].Comments.indexOf(id);
          var replies = dbComments[id].replies;
          dbBlogentries[source].Comments.splice(index, 1);
          db.collection('Blogentries').doc(source).update({
            Comments: dbBlogentries[source].Comments
          });
          delete dbComments[id];
          db.collection('Comments').doc(id).delete();
          for (var i = 0; i < replies.length; i++) {
            delete dbCommentReplies[replies[i]];
            db.collection('CommentReplies').doc(replies[i]).delete();
          }
          res.end();
        } else {
          res.status(403).end();
        }
      } else if (typ == 'media') {
        if (dbComments[id].author == uid || dbUser[uid].Rank == 'admin') {
          var index = dbMedia[source].Comments.indexOf(id);
          var replies = dbComments[id].replies;
          dbMedia[source].Comments.splice(index, 1);
          db.collection('Media').doc(source).update({
            Comments: dbMedia[source].Comments
          });
          delete dbComments[id];
          db.collection('Comments').doc(id).delete();
          for (var i = 0; i < replies.length; i++) {
            delete dbCommentReplies[replies[i]];
            db.collection('CommentReplies').doc(replies[i]).delete();
          }
          res.end();
        } else {
          res.status(403).end();
        }
      } else if (typ == 'comment') {
        if (dbCommentReplies[id].author == uid || dbUser[uid].Rank == 'admin') {
          var index = dbComments[source].replies.indexOf(id);
          dbComments[source].replies.splice(index, 1);
          db.collection('Comments').doc(source).update({
            replies: dbComments[source].replies
          });
          delete dbCommentReplies[id];
          db.collection('CommentReplies').doc(id).delete();
          res.end();
        } else {
          res.status(403).end();
        }
      } else if (typ == 'status') {
        if (dbComments[id].author == uid || dbUser[uid].Rank == 'admin') {
          var index = dbStatusUpdates[source].Comments.indexOf(id);
          var replies = dbComments[id].replies;
          dbStatusUpdates[source].Comments.splice(index, 1);
          db.collection('StatusUpdates').doc(source).update({
            Comments: dbStatusUpdates[source].Comments
          });
          delete dbComments[id];
          db.collection('Comments').doc(id).delete();
          for (var i = 0; i < replies.length; i++) {
            delete dbCommentReplies[replies[i]];
            db.collection('CommentReplies').doc(replies[i]).delete();
          }
          res.end();
        } else {
          res.status(403).end();
        }
      }
    }).catch((err) => {
      res.status(500);
      admin.auth().verifyIdToken(req.body.idToken).catch(() => {
        res.status(401);
      }).then(() => auth(req.body.idToken)).catch(() => {
        res.status(403);
      }).then(() => { res.end(err) });
    });
});

app.post('/reportComment', (req,res) => {
  auth(req.body.idToken)
    .then((uid) => {
      var commentId = req.body.commentId;
      var containerTyp = req.body.containerTyp;
      var containerId = req.body.containerId;
      var mainTyp = req.body.mainTyp;
      var mainId = req.body.mainId;
      var link = req.body.link;
      var author = '';
      var content = '';
      var commentTyp = '';;
      if (containerTyp == 'comment') {
        author = dbCommentReplies[commentId].author;
        content = dbCommentReplies[commentId].content;
        commentTyp = 'Comment Reply';
      } else {
        author = dbComments[commentId].author;
        content = dbComments[commentId].content;
        commentTyp = 'Comment';
      }
      var text = 'Somebody reported a comment on your blog.\n\n';
      text += 'Reporter: \t\t' + dbUser[uid].Name + ' (' + uid + ')\n\n';
      text += 'Author: \t\t' + dbUser[author].Name + ' (' + author + ')\n';
      text += 'Content: \t\t' + content + '\n\n';
      text += 'ContainerID: \t' + containerId + '\n';
      text += 'CommentTyp: \t' + commentTyp + '\n';
      text += 'CommentID: \t' + commentId + '\n\n';
      text += 'ParentTyp: \t' + mainTyp + '\n';
      text += 'ParentID: \t\t' + mainId + '\n\n';
      text += 'Link: \t\t' + link + '\n';
      var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'noreply.exchangeblog@gmail.com',
          pass: 'U6LJ0omuqEBO6NqxBK82'
        }
      });
      var mailOptions = {
        from: 'Exchange Blog',
        to: 'squamato77@gmail.com',
        subject: 'EB Comment Report Alert',
        text: text
      };
      transporter.sendMail(mailOptions);
      res.end();
    }).catch((err) => {
      res.status(500);
      admin.auth().verifyIdToken(req.body.idToken).catch(() => {
        res.status(401);
      }).then(() => auth(req.body.idToken)).catch(() => {
        res.status(403);
      }).then(() => { res.end(err) });
    });
});

app.post('/getCommentData', (req,res) => {
  var commentId = req.body.commentId;
  var containerTyp = req.body.containerTyp;
  var mainTyp = req.body.mainTyp;
  var mainId = req.body.mainId;
  auth(req.body.idToken)
    .then((uid) => {
      if ((() => {
        if (mainTyp == 'blog') {
          return dbBlogentries[mainId].Visibility.indexOf(dbUser[uid].Rank) != -1;
        } else if (mainTyp == 'media') {
          return dbMedia[mainId].Visibility.indexOf(dbUser[uid].Rank) != -1;
        } else if (mainTyp == 'status') {
          return dbStatusUpdates[mainId].Visibility.indexOf(dbUser[uid].Rank) != -1;
        } else { return false }
      })()) {
        var datasource;
        if (containerTyp == 'comment') {
          datasource = dbCommentReplies;
        } else {
          datasource = dbComments;
        }
        var result = {
          id: commentId,
          content: datasource[commentId].content,
          time: datasource[commentId].time,
          replies: datasource[commentId].replies,
          author: {
            id: datasource[commentId].author,
            name: dbUser[datasource[commentId].author].Nick,
            rank: dbUser[datasource[commentId].author].Rank
          }
        };
        res.json(result);
      } else {
        res.status(403).end();
      }
    }).catch((err) => {
      res.status(500);
      admin.auth().verifyIdToken(req.body.idToken).catch(() => {
        res.status(401);
      }).then(() => auth(req.body.idToken)).catch(() => {
        res.status(403);
      }).then(() => { res.end(err) });
    });
});

app.post('/getActivityFeed', (req,res) => {
  auth(req.body.idToken)
    .then((uid) => {
      var time = req.body.time;
      var contentList = [];
      for (key in dbBlogentries) {
        if (dbBlogentries[key].Visibility.indexOf(dbUser[uid].Rank) != -1) contentList.push({
          typ: 'blog',
          key: key,
          upload: dbBlogentries[key].Upload.release
        });
      }
      for (key in dbMedia) {
        if (dbMedia[key].Visibility.indexOf(dbUser[uid].Rank) != -1) contentList.push({
          typ: 'media',
          key: key,
          upload: dbMedia[key].Upload.release
        });
      }
      for (key in dbStatusUpdates) {
        if (dbStatusUpdates[key].Visibility.indexOf(dbUser[uid].Rank) != -1) contentList.push({
          typ: 'status',
          key: key,
          upload: dbStatusUpdates[key].Upload.release
        });
      }
      contentList.sort((a,b) => {
        if (a.upload.getTime() < b.upload.getTime()) return 1;
        if (a.upload.getTime() > b.upload.getTime()) return -1;
        return 0;
      });
      var result = [];
      for (var i = 0; i < contentList.length; i++) {
        if (result.length == 5) break;
        if (contentList[i].typ == 'blog') {
          if (dbBlogentries[contentList[i].key].Visibility.indexOf(dbUser[uid].Rank) != -1 && contentList[i].upload < time) {
            result.push({
              id: contentList[i].key,
              thumbnail: dbMedia[dbBlogentries[contentList[i].key].Thumbnail].Location,
              title: dbBlogentries[contentList[i].key]['Title_' + req.body.lang],
              intro: dbBlogentries[contentList[i].key]['Intro_' + req.body.lang],
              upload: contentList[i].upload
            });
          }
        } else if (contentList[i].typ == 'media') {
          var medialist = [];
          var date = contentList[i].upload.toLocaleDateString();
          while (i < contentList.length && contentList[i].typ == 'media' && date == contentList[i].upload.toLocaleDateString()) {
            if (dbMedia[contentList[i].key].Visibility.indexOf(dbUser[uid].Rank) != -1 && contentList[i].upload < time) {
              medialist.push(getMetadata('media', contentList[i].key, uid, req.body.lang));
            }
            i++;
          }
          i--;
          if (medialist.length != 0) result.push(medialist);
        } else if (contentList[i].typ == 'status') {
          if (dbStatusUpdates[contentList[i].key].Visibility.indexOf(dbUser[uid].Rank) != -1 && contentList[i].upload < time) {
            result.push({
              id: contentList[i].key,
              author: {
                name: dbUser[dbStatusUpdates[contentList[i].key].Author].Nick,
                rank: dbUser[dbStatusUpdates[contentList[i].key].Author].Rank
              },
              content: dbStatusUpdates[contentList[i].key]['Content_' + req.body.lang],
              upload: contentList[i].upload,
              comments: dbStatusUpdates[contentList[i].key].Comments
            });
          }
        }
      }
      res.json(result);
    }).catch((err) => {
      res.status(500);
      admin.auth().verifyIdToken(req.body.idToken).catch(() => {
        res.status(401);
      }).then(() => auth(req.body.idToken)).catch(() => {
        res.status(403);
      }).then(() => { res.end(err) });
    });
});

app.post('/getUserSettings', (req,res) => {
  auth(req.body.idToken)
    .then((uid) => {
      res.json({
        nick: dbUser[uid].Nick,
        privacy: dbUser[uid].Privacy,
        notifications: dbUser[uid].Notifications,
        notiFrequency: dbUser[uid].NotiFrequency
      });
    }).catch((err) => {
      res.status(500);
      admin.auth().verifyIdToken(req.body.idToken).catch(() => {
        res.status(401);
      }).then(() => auth(req.body.idToken)).catch(() => {
        res.status(403);
      }).then(() => { res.end(err) });
    });
});

/*app.post('/changeNickname', (req,res) => {
  auth(req.body.idToken)
    .then((uid) => {
      dbUser[uid].Nick = req.body.nick;
      db.collection('User').doc(uid).update({
        Nick: req.body.nick
      });
      res.end();
    })
    .catch(() => {
      res.status(403).end();
    })
});

app.post('/changePrivaNoti', (req,res) => {
  auth(req.body.idToken)
    .then((uid) => {
      dbUser[uid].Notifications = JSON.parse(req.body.notifications);
      dbUser[uid].NotiFrequency = parseInt(req.body.notiFrequency);
      db.collection('User').doc(uid).update({
        Notifications: JSON.parse(req.body.notifications),
        NotiFrequency: parseInt(req.body.notiFrequency)
      });
      res.end();
    })
    .catch(() => {
      res.status(403).end();
    })
});*/

app.post('/signUp', (req,res) => {
  if (req.body.uid in dbUser) {
    if (!dbUser[req.body.uid].Active) {
      admin.auth().updateUser(req.body.uid, {
        email: req.body.mail,
        password: req.body.pass
      })
        .then(() => {
          noti = req.body.noti;
          for (key in noti) {
            noti[key] = noti[key] === 'true';
          }
          db.collection('User').doc(req.body.uid).update({ 
            Active: true,
            Name: req.body.name,
            Nick: req.body.nick,
            Notifications: noti,
            NotiFrequency: parseInt(req.body.notifreq)
          });
          res.json({ success: true });
        })
        .catch((err) => {
          res.json({ success: false, error: err });
        })
    } else {
      res.status(403).end();
    }
  } else {
    res.status(404).end();
  }
});

app.post('/changeSettings', (req,res) => {
  auth(req.body.idToken).then((uid) => {
    noti = req.body.noti;
    for (key in noti) {
      noti[key] = noti[key] === 'true';
    }
    return db.collection('User').doc(uid).update({ 
      Nick: req.body.nick,
      Notifications: noti,
      NotiFrequency: parseInt(req.body.notifreq)
    });
  }).then(() => {
    res.end();
  }).catch((err) => {
    res.status(500);
    admin.auth().verifyIdToken(req.body.idToken).catch(() => {
      res.status(401);
    }).then(() => auth(req.body.idToken)).catch(() => {
      res.status(403);
    }).then(() => { res.end(err) });
  });
});

app.post('/getUserData',(req,res) => {
  auth(req.body.idToken).then((uid) => {
    res.json({
      name: dbUser[uid].Nick,
      rank: dbUser[uid].Rank
    });
  }).catch((err) => {
    res.status(500);
    admin.auth().verifyIdToken(req.body.idToken).catch(() => {
      res.status(401);
    }).then(() => auth(req.body.idToken)).catch(() => {
      res.status(403);
    }).then(() => { res.end(err) });
  });
});


/*

Das war mal dafür gedacht, eine Email Authentifizierung zu bauen, 
weil die von Firebase irgendwie nicht funktioniert hat.
Tatsächlich hat sie sehr wohl funktioniert... mein Postfach war einfach voll >.<

So kann man mal eben 2 Stunden Zeit verschwenden...

app.post('/verifyEmail', (req,res) => {
  auth(req.body.idToken)
    .then((uid) => {
      var key = createNewDatabaseKey();
      db.collection('User').doc(uid).update({
        AuthId: key
      });
      admin.auth().getUser(uid)
        .then((user) => {
          console.log(user.email,key)
          var text = 'Hello,\n\nIn order to verify your e-mail adress, please follow this link:\n\n';
          text += 'https://exchange-blog.com/authenticate/' + uid + '/' + key + '/\n\n';
          text += 'If you didn’t ask to verify this address, you can ignore this email.\n\n';
          text += 'Your Exchange Blog Team';
          var transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: 'noreply.exchangeblog@gmail.com',
              pass: 'U6LJ0omuqEBO6NqxBK82'
            }
          });
          var mailOptions = {
            from: 'Exchange Blog',
            to: user.email,
            subject: 'Verify your Exchange Blog e-mail',
            text: text
          };
          transporter.sendMail(mailOptions);
          res.end();
        });
    })
    .catch(() => {
      res.status(403).end();
    });
})

app.get('/authenticate/:uid/:key', (req,res) => {
  try {
    if (dbUser[req.params.uid].AuthId == req.params.key) {
      db.collection('User').doc(req.params.uid).update({
        AuthId: FieldValue.delete()
      });
      admin.auth().updateUser(req.body.uid, {
        emailVerified: true
      })
        .then(() => {
          res.send('Your e-mail address has been successfully verified :)');
        })
        .catch(() => {
          res.send('Your verification link is invalid :/');
        });
    } else {
      res.send('Your verification link is invalid :/');
    }
  } catch (e) {
    res.send('Your verification link is invalid :/');
  }
});*/

function auth(idToken) {
  return new Promise((resolve,reject) => {
    admin.auth().verifyIdToken(idToken)
    .then(function(decodedToken) {
      var uid = decodedToken.uid;
      if (dbUser[uid] == undefined) {
        db.collection('User').doc(uid).get()
        .then(doc => {
          if (doc.exists) {
            resolve(uid);
          } else {
            console.log('Invalid User Account: ' + uid + ' -> Disabling Account.');
            admin.auth().updateUser(uid, {
              disabled: true
            })
              .then(function (userRecord) {
                console.log('User Account has been disabled.');
                reject();
              });
          }
        });
      } else {
        resolve(uid);
      }
    }).catch(function(error) {
      console.log('Token is invalid. Error occured: ', error);
      reject();
    });
  });

}

function evaluateIdList(mediaidlist,uid,lang) {
  mediaidlist.sort((a, b) => {
    if (dbMedia[a].Upload.true.getTime() < dbMedia[b].Upload.true.getTime()) return 1;
    if (dbMedia[a].Upload.true.getTime() > dbMedia[b].Upload.true.getTime()) return -1;
    return 0;
  });
  var medialist = [];
  for (var i = 0; i < mediaidlist.length; i++) {
    if (dbMedia[mediaidlist[i]].Visibility.indexOf(dbUser[uid].Rank) != -1) 
      medialist.push(getMetadata('media',mediaidlist[i],uid,lang));
  }
  return medialist;
}

function getMetadata(typ,mid,uid,lang) {
  var socialobject = {};
  if (typ == 'media') {
    socialobject.typ = dbMedia[mid].Typ;
    socialobject.id = mid;
    socialobject.upload = dbMedia[mid].Upload.release;
    socialobject.location = dbMedia[mid].Location;
    socialobject.description = dbMedia[mid]['Description_' + lang];
    socialobject.comments = getComments(dbMedia[mid].Comments, dbComments, false, uid);
  } else if (typ == 'blogpost') {
    socialobject.title = dbBlogentries[mid]['Title_' + lang];
    socialobject.thumbnail = dbMedia[dbBlogentries[mid].Thumbnail].Location;
    socialobject.intro = dbBlogentries[mid]['Intro_' + lang];
    socialobject.content = dbBlogentries[mid]['Content_' + lang];
    socialobject.upload = dbBlogentries[mid].Upload.release;
    socialobject.comments = getComments(dbBlogentries[mid].Comments, dbComments, true, uid);
  }
  return socialobject;
}

function getComments(commentlist,reference,searchReplies,uid) {
  var comments = [];
  for (var i = 0; i < commentlist.length; i++) {
    var newcomment = {};
    var commentkey = commentlist[i];
    newcomment.content = reference[commentkey].content;
    newcomment.time = reference[commentkey].time;
    newcomment.id = commentkey;
    var authorkey = reference[commentkey].author;
    newcomment.author = {
      id: authorkey,
      name: dbUser[authorkey].Nick,
      rank: dbUser[authorkey].Rank
    };
    if (searchReplies) newcomment.replies = getComments(reference[commentkey].replies, dbCommentReplies, false, uid);
    comments.push(newcomment);
  }
  return comments;
}

//Reference: https://stackoverflow.com/a/4835406
function escapeHtml(text) {
  var map = {
    '<': '&lt;',
    '>': '&gt;'
  };
  return '<p>' + text
    .replace(/[<>]/g, function (m) { return map[m]; })
    .split(/\\n/)
    .join('</p><p>') + '</p>';
}

function createNewDatabaseKey() {
  var map = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var id = '';
  do {
    id += map.substr(Math.floor(Math.random() * 26),1);
    for (var i = 0; i < 19; i++) {
      id += map.substr(Math.floor(Math.random() * 36), 1);
    }

  } while(
    (id in dbBlogentries) ||
    (id in dbMedia) ||
    (id in dbStatusUpdates) ||
    (id in dbComments) ||
    (id in dbCommentReplies)
  );
  return id;
}

app.use(function (req, res) {
  res.status(404).end();
});

exports.expressapp = functions.https.onRequest(app);
