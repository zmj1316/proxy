/**
 * shiedman@gmail.com
 * main 
 */

var express = require('express')
  , http = require('http')
  , net = require('net')
  , fs = require('fs')
  , path = require('path')
  , urlparse = require('url').parse
  , util =require('util');

var ut=require('./lib/utility.js')
  ,dir=require('./lib/directory')
  , httptask = require('./lib/httptask')
  , xunlei = require('./lib/xunlei')
  , baidu = require('./lib/baidu')
  , weibo = require('./lib/weibo')
  , goagent = require('./lib/goagent')
  , wallproxy = require('./lib/wallproxy')
  , proxy = require('./lib/proxy')
  //, dotcloud = require('./lib/dotcloud') //##remove##
  , _9gal = require('./lib/9gal.js') //##remove##
  , _115 = require('./lib/115.js') //##remove##
  , _vdisk = require('./lib/vdisk.js') //##remove##
  , forward = require('./lib/forward');

//var SERVER_PORT=process.env.PORT_OTHER||process.env.PORT_WWW;
var SERVER_PORT=process.env.PORT_WWW;
var logLevel='dev'
  , PORT=80
  , ROOT='d:/home';

ut.Cookie.load();ut.ini.load();
//setInterval(function(){ _9gal.takeBonus();},15000);//##remove##
if(SERVER_PORT){
    logLevel='tiny',PORT=SERVER_PORT;
    ROOT='/home/dotcloud/data';
    process.env.SERVER=SERVER_PORT;
    process.on('SIGTERM',function(){
    //process.on('exit',function(){
        console.warn(new Date()+' proxyServer is exiting....');
        ut.Cookie.save();
        ut.ini.write();
        process.exit(1);//if return 0,supervisor won't respawn proccess
    });
    function _watchfile(){
    fs.watchFile(ut.Cookie.file,function(cur,prev){
        util.log('reloading '+ut.Cookie.file);
        ut.Cookie.load();
    });
    fs.watchFile(ut.ini.file,function(cur,prev){
        util.log('reloading '+ut.ini.file);
        ut.ini.load();
    });
    }
    _watchfile();
    //execute every 1 hour
    setInterval(function(){
        fs.unwatchFile(ut.Cookie.file);
        fs.unwatchFile(ut.ini.file);
        setTimeout(function(){ut.Cookie.save();ut.ini.write();},5000);
        setTimeout(_watchfile,15000);
    },3600000);
    //execute every 10mins
    setInterval(function(){ _9gal.takeBonus();_115.takeBonus();_vdisk.takeBonus();},600000);//##remove##
}
//process.on('SIGINT', function () {
  //console.log('Got SIGINT.  Press Control-D to exit.');
//});


var app = express();

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.enable('trust proxy');

//http://www.senchalabs.org/connect/middleware-logger.html
  app.use(express.logger(logLevel));

  //app.use(xunlei.logRequest);
  //app.use(baidu.logRequest);
  app.use(function(req,res,next){
      if(req.url.substring(0,4)=='http'){ proxy.handle(req,res); }else{ next();}
  });
  app.use('/jsonrpc_',function (req,res,next){
      forward('localhost',6800,'/jsonrpc'+req.url.substring(1))(req,res);
  });
  app.use(express.favicon());
  app.use(express.bodyParser());
  //app.use(express.methodOverride());


  //app.use(express.cookieParser('nosecret'));
  //app.use(express.cookieSession());
  //app.use(express.session());
  app.use(app.router);

  app.use(express.static(path.join(__dirname, 'bootstrap')));
  app.use(express.static(path.join(__dirname, 'static')));
  app.use(express.static(ROOT));
  app.use(dir.directory(ROOT));

  app.locals.pretty=true;
  setInterval(function(){ httptask.updateTask();},30000);
});
//var auth=express.basicAuth('admin','supass');
/**
app.get(/^\/_upload\/(.+)$/,function(req,res){
    try{
        //console.log(req.params[0]);
        var filepath=path.join(ROOT,req.params[0]);
        console.log(filepath);
        kuai.upload(filepath);
        console.log('dispatching to ',req.params[0]);
        res.send('uploading....');
    }catch(err){
        res.send('upload failed:',err.message);
    }
});
*/
app.get('/tasks',httptask.viewTasks);
app.post('/agentfetch',goagent.serve);
app.post('/wallfetch',wallproxy.serve);

app.post('/__jsonrpc',function(req,res){
    var method=req.body.method;
    var params=req.body.params;
    try{
        if(params.file){
            filepath=path.normalize(params.file);
            if(!fs.existsSync(filepath)) throw new Error('file not exists: '+filepath);
            var stat=fs.statSync(filepath);
            if(!stat.isFile())throw new Error('not a File: '+filepath);
        }
        if(method=='xunlei.upload'){
            httptask.queue(xunlei.upload,[params.file]);
            //xunlei.upload(params.file);
        }else if(method=='baidu.upload'){
            baidu.upload(params.file);
        }else if(method=='weibo.upload'){
            httptask.queue(weibo.upload,[params.file]);
            //weibo.upload(params.file);
        }else if(method=='httptask.deleteTask'){
            var ret=httptask.deleteTask(params.taskid);
            if(ret<0)throw  new Error(params.taskid+' not exists');
        }else if(method=='httptask.abortTask'){
            var ret=httptask.abortTask(params.taskid);
            if(ret<0)throw  new Error(params.taskid+' not exists');
        }else if(method=='httptask.listTask'){
            var ret=httptask.listTask(params.type);
            if(!ret)throw  new Error('empty task list');
            return res.json({jsonrpc:'2.0',id:1,result:{'data':ret}});
        }else{
            throw new Error('method:'+method+' not exists');
        }
        res.json({jsonrpc:'2.0',id:1,result:'success'});
    }catch(err){
        console.log(err.message);
        console.log(err.stack);
        res.json({jsonrpc:'2.0',id:1,error:{message:err.message}});
    }
});

app.configure('development', function(){
    app.use(express.errorHandler({ showStack: true, dumpExceptions: true }));
    //app.get('/dotcloud',dotcloud.get);//##remove##
    //app.post('/dotcloud',dotcloud.post);//##remove##
});
app.configure('production', function(){
    app.use(express.errorHandler());
});


app.get('/info',function(req,res){
    var _conf={http_url:'http://localhost/',ssh_url:'',proxy_url:'localhost'};
    if(SERVER_PORT){
        var _env=require('/home/dotcloud/environment.json');
        _conf={
        http_url:_env.DOTCLOUD_WWW_HTTP_URL,
        ssh_url:_env.DOTCLOUD_WWW_SSH_URL.replace('ssh://',''),
        proxy_url:_env.DOTCLOUD_WWW_PROXY_URL.replace('tcp://','')
        }
    }
    res.render('info',{conf:_conf});
});

var httpserver=http.createServer(app);
httpserver.on('connect', function(req, cltSocket, head) {
    var srvUrl = urlparse('http://' + req.url);
    util.log('CONNECT: '+req.url);
    var srvSocket = net.connect(srvUrl.port, srvUrl.hostname, function() {
        cltSocket.write('HTTP/1.1 200 Connection Established\r\n' +
            'Proxy-agent: Node-Proxy\r\n\r\n');
        if(head&&head.length>0)srvSocket.write(head);
        srvSocket.pipe(cltSocket);
        cltSocket.pipe(srvSocket);
    });
    srvSocket.on('error',function (err){
        console.error(err);
    });
    //srvSocket.on('timeout',function(){
        //console.error('connection timeout!!!');
    //});
});
httpserver.on('clientError',function(err){
    util.log('clientError: '+err.message);
});

if(SERVER_PORT){
var tty=require('./tty/tty.js');
var ttyapp=tty.createServer({
    app:app,
    server:httpserver,
	shell:'bash',
    cwd:'~/data/downloads',
	port: PORT
});
ttyapp.listen();
}else{

httpserver.listen(PORT, function(){
  console.log("Express server listening on port %s",PORT);
});
}
