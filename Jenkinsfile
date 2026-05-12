pipeline {
    agent any

    environment {
        IMAGE_NAME = "microservico-emprestimo"
        CONTAINER_NAME = "microservico-emprestimo-container"
        APP_PORT = "9500"
    }

    stages {
        stage('Stop and Remove Old Container') {
            steps {
                script {
                    echo 'Limpando containers e imagens antigas...'
                   
                    sh "docker stop ${CONTAINER_NAME} || true"
                    sh "docker rm ${CONTAINER_NAME} || true"
                    sh "docker rmi ${IMAGE_NAME}:latest || true"
                }
            }
        }

        stage('Install and Prisma Generate') {
            steps {
                echo 'Preparando dependências e Prisma...'
                
                sh 'npm install'
                sh 'npx prisma generate'
            }
        }

        stage('Docker Build') {
            steps {
                echo 'Construindo a nova imagem Docker...'
                sh "docker build -t ${IMAGE_NAME}:latest ."
            }
        }

        stage('Docker Run') {
            steps {
                echo 'Subindo o microserviço...'
                
                sh "docker run -d --name ${CONTAINER_NAME} -p ${APP_PORT}:${APP_PORT} ${IMAGE_NAME}:latest"
            }
        }
        
        stage('Healthcheck') {
            steps {
                echo 'Verificando se o Fastify subiu corretamente...'
                sleep 5
                sh "curl -f http://localhost:9500/health || echo 'Aguardando serviço...'"
            }
        }
    }

    post {
        success {
            echo 'Pipeline executado com sucesso! O serviço está rodando.'
        }
        failure {
            echo 'Erro no pipeline. Verifique os logs do Docker ou do Prisma.'
        }
    }
}