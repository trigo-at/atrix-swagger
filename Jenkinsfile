node('linux') {
	stage('checkout source') {
		checkout scm
	}

	stage('services') {
		sh 'make ci-test'
	}

	stage('Publish') {
		sh 'make publish'
	}
}
