const fetch = require('node-fetch');  
fetch('https://api.github.com/repos/Grupo-Q-Max/Grupo-Q-Max/actions/runs?per_page=3').then(r=>r.json()).then(d=>console.log(d.workflow_runs.map(r=>({status:r.status, conclusion:r.conclusion, commit:r.head_commit.message}))))  
