all:
	npm run build

clean:
	nsmake stop
	rm -rf ~/.nsmake/build ~/.nsmake/server.log

status:
	git status 
	cd ext/Hpipe; git status 
	cd ext/Evel; git status 
	cd ../nsmake; git status 

push:
	git commit -a && git push
	cd ext/Hpipe; git commit -a && git push 
	cd ext/Evel; git commit -a && git push 
	cd ../nsmake; git commit -a && git push 
