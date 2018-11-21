include config.mk

all: src/${JQ_FILE} src/${POSTGRESQL_FILE} src/${NODE_FILE} src/${REDIS_SERVER_DIR}/finished src/${LISK_SCRIPTS_DIR}/finished  src/${BUILD_NAME}.tar.gz

src/${BUILD_NAME}.tar.gz: src/${BUILD_NAME}/finished
	rm -rf release/*
	
	cd src ; tar czf "../release/${BUILD_NAME}.tar.gz" "${BUILD_NAME}"
	sha256sum release/${BUILD_NAME}.tar.gz > release/${BUILD_NAME}.tar.gz.SHA256	

src/${BUILD_NAME}/finished: src/${LISK_FILE}
	tar -Jxf src/${NODE_FILE} --strip-components=1 --directory="src"
	rm -rf src/${BUILD_NAME}
	tar xf src/${LISK_FILE} --directory=src
	mv src/package src/${BUILD_NAME}
	# move node.js into lisk directory
	mv src/bin src/${BUILD_NAME}
	mv src/include src/${BUILD_NAME}
	mv src/lib src/${BUILD_NAME}
	mv src/share src/${BUILD_NAME}

	tar xf src/${POSTGRESQL_FILE} --directory=src/${BUILD_NAME} --exclude=doc --exclude=include --exclude="pgAdmin 4" --exclude=stackbuilder

	cp -f src/${REDIS_SERVER_DIR}/src/${REDIS_SERVER_OUT} src/${BUILD_NAME}/bin/${REDIS_SERVER_OUT}
	cp -f src/${REDIS_SERVER_DIR}/src/${REDIS_SERVER_CLI} src/${BUILD_NAME}/bin/${REDIS_SERVER_CLI}
	strip src/${BUILD_NAME}/bin/${REDIS_SERVER_OUT} src/${BUILD_NAME}/bin/${REDIS_SERVER_CLI}
	mkdir -p src/${BUILD_NAME}/redis

	cp -f src/${JQ_FILE} src/${BUILD_NAME}/bin/${JQ_FILE}
	strip src/${BUILD_NAME}/bin/${JQ_FILE}
	chmod +x src/${BUILD_NAME}/bin/${JQ_FILE}

	cp -vrf src/${LISK_SCRIPTS_DIR}/packaged/* src/${BUILD_NAME}

	echo "export LISK_NETWORK=mainnet" >> src/${BUILD_NAME}/env.sh
	
	echo '{}' > src/${BUILD_NAME}/config.json

	cp src/${BUILD_NAME}/config.json src/${BUILD_NAME}/etc/snapshot.json
        
	src/${BUILD_NAME}/bin/${JQ_FILE} '.httpPort=9000' src/${BUILD_NAME}/etc/snapshot.json |sponge src/${BUILD_NAME}/etc/snapshot.json
	src/${BUILD_NAME}/bin/${JQ_FILE} '.wsPort=9001' src/${BUILD_NAME}/etc/snapshot.json |sponge src/${BUILD_NAME}/etc/snapshot.json
	src/${BUILD_NAME}/bin/${JQ_FILE} '.logFileName="logs/lisk_snapshot.log"' src/${BUILD_NAME}/etc/snapshot.json |sponge src/${BUILD_NAME}/etc/snapshot.json
	src/${BUILD_NAME}/bin/${JQ_FILE} '.fileLogLevel="info"' src/${BUILD_NAME}/etc/snapshot.json |sponge src/${BUILD_NAME}/etc/snapshot.json
	src/${BUILD_NAME}/bin/${JQ_FILE} '.db.database="lisk_snapshot"' src/${BUILD_NAME}/etc/snapshot.json |sponge src/${BUILD_NAME}/etc/snapshot.json
	src/${BUILD_NAME}/bin/${JQ_FILE} '.peers.list=[]' src/${BUILD_NAME}/etc/snapshot.json |sponge src/${BUILD_NAME}/etc/snapshot.json
	src/${BUILD_NAME}/bin/${JQ_FILE} '.loading.loadPerIteration=101' src/${BUILD_NAME}/etc/snapshot.json |sponge src/${BUILD_NAME}/etc/snapshot.json

	export PATH="src/${BUILD_NAME}/bin:${PATH}" ; \
	cd src/${BUILD_NAME} ; \
	npm install --production ;\
        npm install --production --global "pm2@${PM2_VERSION}" ;\
        npm install --production --global "lisk-commander@${LISK_COMMANDER_VERSION}"


	date "+%H:%M:%S %d/%m/%Y" >src/${BUILD_NAME}/.build
	date >src/${BUILD_NAME}/finished

src/${LISK_FILE}:
	tar -Jxf src/${NODE_FILE} --strip-components=1 --directory="src"
	src/bin/npm pack ..
	mv ${LISK_FILE} src/${LISK_FILE}

src/${LISK_SCRIPTS_DIR}/finished: src/${LISK_SCRIPTS_FILE}
	echo "${LISK_SCRIPTS_SHA256SUM}  src/${LISK_SCRIPTS_FILE}" | sha256sum -c
	rm -rf ${LISK_SCRIPTS_DIR}
	tar -C src -xf src/${LISK_SCRIPTS_FILE}
	touch src/${LISK_SCRIPTS_DIR}/finished

src/${LISK_SCRIPTS_FILE}:
	wget -nv ${LISK_SCRIPTS_URL} --output-document=src/${LISK_SCRIPTS_FILE}

src/${REDIS_SERVER_DIR}/finished: src/${REDIS_SERVER_FILE}
	rm -rf src/${REDIS_SERVER_DIR}
	tar -C src -xf src/${REDIS_SERVER_FILE}
	make -C src/${REDIS_SERVER_DIR}
	make -C src/${REDIS_SERVER_DIR} check
	touch src/${REDIS_SERVER_DIR}/finished

src/${REDIS_SERVER_FILE}:
	wget -nv ${REDIS_SERVER_URL} --output-document=src/${REDIS_SERVER_FILE}
	echo "${REDIS_SHA256SUM}  src/${REDIS_SERVER_FILE}" | sha256sum -c


src/${NODE_FILE}:
	wget -nv ${NODE_BIN_URL} --output-document=src/${NODE_FILE}
	echo "${NODE_SHA256SUM}  src/${NODE_FILE}" | sha256sum -c

src/${POSTGRESQL_FILE}:
	wget -nv ${POSTGRESQL_BIN_URL} --output-document=src/${POSTGRESQL_FILE}
	echo "${POSTGRESQL_SHA256SUM}  src/${POSTGRESQL_FILE}" | sha256sum -c

src/${JQ_FILE}:
	wget -nv ${JQ_BIN_URL} --output-document=src/${JQ_FILE}
	echo "${JQ_SHA256SUM}  src/${JQ_FILE}" | sha256sum -c

../REVISION:
	git rev-parse HEAD >../REVISION

.PHONY: clean
clean:
	rm -rf release/* src/* ../REVISION
