pipeline {
    agent any

    environment {
        // Variáveis seguras
        INFISICAL_TOKEN      = "st.78331314-da2c-40d7-829c-64e1baa1a4a8.ce97554862d25689b83e5730d93756e7.5a84652d45eb8c9411c301ab944e9012"
        DATABASE_URL         = "mysql://20261_projint5_manha:senac%4012938@edumysql.acesso.rj.senac.br:3306/20261_projint5_manha_biblioteca_emprestimo"
        APP_PORT             = "9500"
    }

    stages {
        stage('Deploy com Docker Compose') {
            steps {
                script {
                    echo 'Criando arquivo .env temporário para o Docker Compose...'
                    // Injeta as credenciais no .env para o Compose e Prisma lerem
                    sh """
                        echo "INFISICAL_TOKEN=${INFISICAL_TOKEN}" > .env
                        echo "DATABASE_URL=${DATABASE_URL}" >> .env
                    """
                    
                    echo 'Construindo e subindo o microsserviço...'
                    sh "docker compose up -d --build"
                    
                    echo 'Limpando credenciais locais por segurança...'
                    sh "rm .env || true"
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
            sh "docker logs biblioteca-emprestimo || true"
        }
    }
}