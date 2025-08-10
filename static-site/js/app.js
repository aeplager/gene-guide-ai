const API_BASE = "/api";

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;

  if (page === 'login') {
    let isLogin = true;
    const toggleBtn = document.getElementById('toggle-form');
    const nameGroup = document.getElementById('name-group');
    const confirmGroup = document.getElementById('confirm-password-group');
    const title = document.getElementById('form-title');
    const description = document.getElementById('form-description');
    const submitBtn = document.getElementById('submit-btn');

    toggleBtn.addEventListener('click', () => {
      isLogin = !isLogin;
      title.textContent = isLogin ? 'Welcome back' : 'Create account';
      description.textContent = isLogin ? 'Sign in to access your genetic health insights' : 'Join us to understand your genetic health better';
      toggleBtn.textContent = isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in";
      nameGroup.style.display = isLogin ? 'none' : 'block';
      confirmGroup.style.display = isLogin ? 'none' : 'block';
      submitBtn.textContent = isLogin ? 'Sign In' : 'Create Account';
    });

    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      // in real app we'd POST to `${API_BASE}/login`
      window.location.href = 'index.html';
    });
  }

  if (page === 'condition') {
    const results = {
      gene: 'BRCA1',
      variant: 'c.185delAG',
      classification: 'Pathogenic',
      condition: 'Hereditary Breast and Ovarian Cancer Syndrome',
      riskLevel: 'High',
      description: 'This genetic variant significantly increases the risk of developing breast and ovarian cancers.',
      implications: [
        'Increased lifetime risk of breast cancer (60-80%)',
        'Increased lifetime risk of ovarian cancer (20-40%)',
        'Earlier onset of cancer is possible',
        'Family members may also be at risk'
      ],
      recommendations: [
        'Enhanced screening starting at age 25',
        'Consider preventive measures (discussed with healthcare team)',
        'Genetic counseling for family members',
        'Regular monitoring and checkups'
      ],
      resources: [
        'National Cancer Institute Guidelines',
        'BRCA Support Groups',
        'Preventive Care Options',
        'Family Testing Information'
      ]
    };

    document.getElementById('condition-name').textContent = results.condition;
    document.getElementById('gene-variant').textContent = `Gene: ${results.gene} | Variant: ${results.variant}`;
    document.getElementById('classification').textContent = results.classification;
    document.getElementById('description').textContent = results.description;

    const implicationsList = document.getElementById('implications');
    results.implications.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      implicationsList.appendChild(li);
    });

    const recommendationsList = document.getElementById('recommendations');
    results.recommendations.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      recommendationsList.appendChild(li);
    });

    const resourcesList = document.getElementById('resources');
    results.resources.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      resourcesList.appendChild(li);
    });

    document.getElementById('go-to-qa').addEventListener('click', () => {
      window.location.href = 'qa.html';
    });
  }

  if (page === 'qa') {
    const chatList = document.getElementById('chat-messages');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    const addMessage = (content, sender = 'user') => {
      const div = document.createElement('div');
      div.className = `chat-message ${sender}`;
      div.textContent = content;
      chatList.appendChild(div);
      chatList.scrollTop = chatList.scrollHeight;
    };

    sendBtn.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;
      addMessage(text, 'user');
      input.value = '';
      setTimeout(() => {
        addMessage('Thanks for your question. This is a demo response based on your BRCA1 results.', 'ai');
      }, 1000);
    });
  }
});
