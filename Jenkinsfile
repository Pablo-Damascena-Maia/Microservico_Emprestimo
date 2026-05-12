pipeline {
    agent any

    // Define as ferramentas configuradas no seu Jenkins
    tools {
        maven 'Maven3' // Certifique-se que este nome existe no Global Tool Configuration
        jdk 'Java17'
    }

    environment {
        // Variáveis de ambiente úteis
        DOCKER_IMAGE = "pablodamascena/microservico-emprestimo"
    }

    stages {
        stage('Preparar') {
            steps {
                echo 'Iniciando o build do Microserviço de Empréstimo...'
                checkout scm
            }
        }

        stage('Build & Testes') {
            steps {
                // Executa o Maven para compilar e testar
                sh 'mvn clean package'
            }
        }

        stage('Arquivar Artefatos') {
            steps {
                // Guarda o arquivo .jar gerado para consulta posterior no Jenkins
                archiveArtifacts artifacts: 'target/*.jar', fingerprint: true
            }
        }

        stage('Construir Imagem Docker') {
            steps {
                script {
                    // Cria a imagem Docker baseada no seu Dockerfile
                    sh "docker build -t ${DOCKER_IMAGE}:${env.BUILD_ID} ."
                }
            }
        }
    }

    post {
        always {
            echo 'Limpando o ambiente de trabalho...'
            deleteDir()
        }
        success {
            echo 'Sucesso: O microserviço está pronto para o deploy!'
        }
        failure {
            echo 'Erro: Verifique os logs do console para depurar.'
        }
    }
}