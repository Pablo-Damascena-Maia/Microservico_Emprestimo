pipeline {
    agent any

    environment {
        // Nome da imagem Docker que será gerada
        IMAGE_NAME = "pablo-damascena/microservico-emprestimo"
        // No Jenkins, configure estas credenciais para o Docker Hub, se necessário
        DOCKER_HUB_USER = "mysql://20261_projint5_manha:senac@12938@edumysql.acesso.rj.senac.br:3306/20261_projint5_manha_biblioteca_emprestimo" 
    }

    stages {
        stage('Setup & Install') {
            steps {
                echo 'Instalando dependências...'
                // O comando 'npm ci' é mais seguro para ambientes de CI/CD
                sh 'npm ci'
            }
        }

        stage('Prisma Generate') {
            steps {
                echo 'Gerando o Prisma Client...'
                // Essencial para o Fastify conseguir importar o @prisma/client
                sh 'npx prisma generate'
            }
        }

        stage('Lint & Security Scan') {
            steps {
                echo 'Verificando vulnerabilidades...'
                sh 'npm audit fix --audit-level=high || true'
            }
        }

        stage('Build Application') {
            steps {
                echo 'Compilando o projeto (Fastify/TypeScript)...'
                // Executa o script de build definido no seu package.json
                sh 'npm run build'
            }
        }

        stage('Docker Image') {
            steps {
                script {
                    echo 'Construindo a imagem Docker...'
                    // Build da imagem usando o commit ID como tag para rastreabilidade
                    sh "docker build -t ${IMAGE_NAME}:latest -t ${IMAGE_NAME}:${env.BUILD_ID} ."
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline finalizado com sucesso!'
            // Aqui você poderia adicionar um comando para enviar para o Docker Hub
            // sh "docker push ${IMAGE_NAME}:latest"
        }
        failure {
            echo 'Ocorreu um erro no Pipeline. Verifique os logs de build.'
        }
    }
}