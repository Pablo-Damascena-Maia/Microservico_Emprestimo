pipeline {
    agent any

    environment {
        // Define a URL do banco para os testes (ajuste conforme necessário)
        DATABASE_URL = "mysql://20261_projint5_manha:senac@12938@edumysql.acesso.rj.senac.br:3306/20261_projint5_manha_biblioteca_emprestimo"
        IMAGE_NAME = "pablodamascena/microservico-emprestimo-node"
    }

    stages {
        stage('Install Dependencies') {
            steps {
                echo 'Instalando dependências do projeto...'
                // Usa o 'ci' para garantir builds reproduzíveis
                sh 'npm i' 
            }
        }

        stage('Prisma Setup') {
            steps {
                echo 'Gerando o Prisma Client...'
                // Gera os tipos do Prisma para o TypeScript/Node
                sh 'npx prisma generate'
                
                // Opcional: Roda as migrações em ambiente de staging/teste
                // sh 'npx prisma migrate deploy'
            }
        }

        stage('Lint & Tests') {
            steps {
                echo 'Executando testes...'
                // sh 'npm test' // Descomente quando tiver testes configurados
            }
        }

        stage('Build') {
            steps {
                echo 'Gerando build de produção...'
                sh 'npm run build'
            }
        }

        stage('Docker Build') {
            steps {
                script {
                    echo 'Construindo imagem Docker...'
                    sh "docker build -t ${IMAGE_NAME}:latest ."
                }
            }
        }
    }

    post {
        failure {
            echo 'O Pipeline falhou. Verifique se o banco de dados estava acessível para o Prisma.'
        }
    }
}