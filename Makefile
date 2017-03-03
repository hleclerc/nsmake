all:
	npm run build

clean:
	nsmake stop
	rm -rf ~/.nsmake/build ~/.nsmake/server.log
