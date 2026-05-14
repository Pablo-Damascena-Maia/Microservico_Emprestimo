pipeline {
    agent any

    environment {
        IMAGE_NAME     = "microservico-emprestimo"
        CONTAINER_NAME = "microservico-emprestimo-container"
        APP_PORT       = "9500"
        NETWORK_NAME   = "biblioteca-net"
        INFISICAL_PROJECT_ID = "e2ce3300-d12b-471d-8954-364aa184c184"
    }

    stages {

        stage('Stop and Remove Old Container') {
            steps {
                script {
                    echo 'Limpando containers e imagens antigas...'
                    sh "docker stop ${CONTAINER_NAME} || true"
                    sh "docker rm   ${CONTAINER_NAME} || true"
                    sh "docker rmi  ${IMAGE_NAME}:latest || true"
                }
            }
        }

        stage('Install and Prisma Generate') {
            steps {
                echo 'Preparando dependências e Prisma...'
                sh 'npm install'
                // Prisma precisa do DATABASE_URL em build time para gerar o client
                withCredentials([string(credentialsId: 'DATABASE_URL', variable: 'DATABASE_URL')]) {
                    sh 'npx prisma generate'
                }
            }
        }

        stage('Docker Build') {
            steps {
                echo 'Construindo a nova imagem Docker...'
                sh "docker build -t ${IMAGE_NAME}:latest ."
            }
        }

        stage('Create Network') {
            steps {
                script {
                    echo 'Garantindo rede Docker biblioteca-net...'
                    sh "docker network create ${NETWORK_NAME} || true"
                }
            }
        }

        stage('Docker Run') {
            steps {
                echo 'Subindo o microserviço com secrets do Infisical...'

                // Credenciais cadastradas em:
                // Jenkins > Manage Jenkins > Credentials > Global
                //   INFISICAL_TOKEN  → Secret text → st.78331314-...
                //   DATABASE_URL     → Secret text → string de conexão do banco

                withCredentials([
                    string(credentialsId: 'INFISICAL_TOKEN', variable: 'INFISICAL_TOKEN'),
                    string(credentialsId: 'DATABASE_URL',    variable: 'DATABASE_URL'),
                ]) {
                    sh """
                        docker run -d \
                          --name    ${CONTAINER_NAME} \
                          --restart unless-stopped \
                          --network ${NETWORK_NAME} \
                          -p ${APP_PORT}:${APP_PORT} \
                          -e INFISICAL_TOKEN=\$INFISICAL_TOKEN \
                          -e INFISICAL_PROJECT_ID=${INFISICAL_PROJECT_ID} \
                          -e INFISICAL_ENV=prod \
                          -e DATABASE_URL=\$DATABASE_URL \
                          -e PORT=${APP_PORT} \
                          -e NODE_ENV=production \
                          ${IMAGE_NAME}:latest
                    """
                }
            }
        }

        stage('Healthcheck') {
            steps {
                echo 'Verificando se o serviço subiu corretamente...'
                sleep 10
                sh "curl -f http://localhost:${APP_PORT}/health || echo 'Serviço ainda iniciando...'"
            }
        }
    }

    post {
        success {
            echo 'Deploy concluído! Microsserviço de Empréstimos rodando na porta 9500.'
        }
        failure {
            echo 'Erro no pipeline. Verificando logs...'
            sh "docker logs ${CONTAINER_NAME} || true"
        }
    }
}
