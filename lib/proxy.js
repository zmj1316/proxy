/*
 ** shiedman (shiedman@gmail.com)
 */
var http = require('http'),
    fs   = require('fs'),
    urlparse  = require('url').parse,
    util  = require('util'),
    net  = require('net');
var Iconv=null;
try{Iconv=require('iconv').Iconv;}catch(err){}
var downloader=require('./downloader.js'),
    ut=require('./utilize.js'),
    block=require('./block.js');

//var request_handlers=[kuai.logRequest,kuai.upload,httptask.viewTasks,block.filter];
//var fetch_handlers=[transfer.download];

//var httpserver=http.createServer(function(request, response) {
exports.handle=function(request, response) {
    var ip = request.connection.remoteAddress;
    if ('proxy-connection' in request.headers){
        request.headers['connection']=request.headers['proxy-connection'];
        delete request.headers['proxy-connection'];
    }
    if(block.filter(request,response))return;
    /**
    var n=0
    var handle_request=function(i){
        if(i<0 || i>=request_handlers.length)return;
        request_handlers[i](request,response,function(err){
            if(err){
                console.err(err);
            }else{
                n++; handle_request(i+1);
            }
        });
    };
    handle_request(n);
    if(n<request_handlers.length)return;
    */

	var url=urlparse(request.url);
    var options={
        hostname:url['hostname'],
        port:url['port']||80,
        path:url['path'],
        method:request.method,
        headers:ut.capitalize(request.headers),
        url:request.url //add url for next use
    };

    var proxy_request = http.request(options,function(proxy_response){
        proxy_request.options=options;
        var buf=downloader.handle(proxy_request,proxy_response);
        if(buf){
            var headers=ut.capitalize(proxy_response.headers);
            headers['Content-Type']='text/plain;charset=utf-8';
            headers['Content-Length']=buf.length;
            response.writeHead(proxy_response.statusCode, headers);
            response.end(buf);
        }else{
            //response.sending=true;
            response.writeHead(proxy_response.statusCode, proxy_response.headers);
            //util.log(request.method+': '+request.url);
            proxy_response.pipe(response);
        }
        /*
        var handle_fetch=function(i){
            if(i<0 || i>=fetch_handlers.length)return;
            fetch_handlers[i](proxy_request,proxy_response,function(buf){
                if(buf){
                    var headers=ut.capitalize(proxy_response.headers);
                    headers['Content-Type']='text/plain;charset=utf-8';
                    headers['Content-Length']=buf.length;
                    response.writeHead(proxy_response.statusCode, headers);
                    response.end(buf);
                }else{
                    m++;handle_fetch(i+1);
                }
            });
        };
        handle_fetch(m);
        if(m<fetch_handlers.length){return;}
        */

    });
    request.pipe(proxy_request);
    proxy_request.setTimeout(30000,function(){
        proxy_request.abort();
        response.end();
        util.error('[timeout:30s]'+request.url);
    });
    proxy_request.on('error',function(err){
        util.error('ERROR: '+request.url);
        util.error('    [REQUEST]:'+err.message);
        if (err.message=='Parse Error')return;
        err.done=true;
        response.statusCode=500;
        response.end();
    });
    proxy_request.on('socket',function(socket){
        //if content-length = 0 or 1,error fired and crashed!!!
        socket.setMaxListeners(25);
        socket.on('error',function(err){
            if(err && err.done)return;
            util.error('ERROR: '+request.url);
            util.error('     [SOCKET]:'+err.message);
            if (proxy_request.rawdata)util.error(proxy_request.rawdata.toString());
            proxy_request.abort();
            if (err.message=='Parse Error')
                request.connection.end(proxy_request.rawdata);
            else
                response.end();
        });
        //work around for gbk attachment filename
        socket.on('data',function(chunk){
            proxy_request.rawdata=chunk;
            downloader.detectFileName(proxy_request,chunk);
        });
    });
    
};
/**
httpserver.on('connection',function(socket){
    var request_count=0;
    socket.on('data',function __callback(data){
        request_count++;
        if (request_count==1){
            //check if data reversed
            var tmp=new Buffer(data);
            _xor(tmp);
            var i=0;
            for (;i<tmp.length-1;i++){
                //find first line
                if (tmp[i]==0x0d && tmp[i+1]==0x0a)break;
            }
            if (i==tmp.length-1){socket.removeListener('data',__callback);return;}
            var line=tmp.toString('utf-8',0,i);
            var arr=line.split(' ');
            var cmd=arr[0],path=arr[1],http_ver=arr[2];
            if (cmd && HTTP_METHODS.indexOf(cmd)>=0){
                socket.orig_write=socket.write;
                socket.write=function (chunk,encoding,callback){
                    if (!Buffer.isBuffer(chunk)){chunk=new Buffer(chunk);}
                    _xor(chunk);
                    return this.orig_write(chunk,encoding,callback);
                }
            }else{
                socket.removeListener('data',__callback);
                return;
            }
        }
        _xor(data);
    });
});
**/