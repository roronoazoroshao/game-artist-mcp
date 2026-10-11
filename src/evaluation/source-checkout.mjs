import {execFileSync} from 'node:child_process';

// The official freeze must bind its claim to GitHub LIVE, not just an
// unfetched refs/remotes/origin/main. Tests may inject a local bare remote.
export const LIVE_SOURCE_REMOTE='https://github.com/roronoazoroshao/game-artist-mcp.git';
const git=(cwd,...args)=>execFileSync('git',args,{
 cwd,encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe'],
 env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_ASKPASS:'/bin/false'}
}).trim();

/** Fail closed before freezing a private evaluation package from local source. */
export function assertCleanMainCheckout({cwd=process.cwd(),expectedSha,remoteUrl=LIVE_SOURCE_REMOTE}){
 if(!/^[a-f0-9]{40}$/.test(expectedSha||''))throw new Error('invalid source SHA');
 let branch,head,originMain;
 try{branch=git(cwd,'symbolic-ref','--quiet','--short','HEAD');}
 catch{throw new Error('freeze source must be on main branch (not detached HEAD)');}
 if(branch!=='main')throw new Error('freeze source must be on main branch');
 try{head=git(cwd,'rev-parse','HEAD');}
 catch{throw new Error('cannot verify git HEAD');}
 if(head!==expectedSha)throw new Error('source SHA does not match local HEAD');
 try{originMain=git(cwd,'rev-parse','--verify','refs/remotes/origin/main');}
 catch{throw new Error('origin/main ref is missing; fetch main before freeze');}
 if(head!==originMain)throw new Error('local main diverges from origin/main; fetch and update main before freeze');
 let dirty;
 try{dirty=git(cwd,'status','--porcelain=v1','--untracked-files=all');}
 catch{throw new Error('cannot verify clean git worktree');}
 if(dirty)throw new Error('freeze source checkout is dirty: commit or remove tracked/untracked changes before freeze');
 let live;
 try{
  const line=git(cwd,'ls-remote','--exit-code',remoteUrl,'refs/heads/main');
  const match=/^([a-f0-9]{40})\s+refs\/heads\/main$/.exec(line);
  if(!match)throw new Error('invalid live ref');
  live=match[1];
 }catch{throw new Error('cannot verify LIVE remote main; network access required for official freeze');}
 if(live!==head)throw new Error('live remote main SHA differs from checked-out main; fetch and re-checkout');
 return head;
}
