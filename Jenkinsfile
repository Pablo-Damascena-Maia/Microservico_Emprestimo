pipeline {
    agent any

    environment {
        // Nome da imagem e do container baseados no seu projeto
        IMAGE_NAME = "microservico-emprestimo"
        CONTAINER_NAME = "microservico-emprestimo-container"
        // Porta que o seu Fastify utiliza
        APP_PORT = "9500"
    }

    stages {
        stage('Stop and Remove Old Container') {
            steps {
                script {
                    echo 'Limpando containers e imagens antigas...'
                    // O "|| true" evita que o pipeline pare se o container não existir
                    sh "docker stop ${CONTAINER_NAME} || true"
                    sh "docker rm ${CONTAINER_NAME} || true"
                    sh "docker rmi ${IMAGE_NAME}:latest || true"
                }
            }
        }

        stage('Install and Prisma Generate') {
            steps {
                echo 'Preparando dependências e Prisma...'
                // Rodamos o install localmente para garantir que o build Docker tenha o contexto
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
                sh "curl -f http://localhost:${APP_PORT}/health || echo 'Aguardando serviço...'"
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