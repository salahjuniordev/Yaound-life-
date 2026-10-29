import { useState } from 'react';
import { useGame } from '../../state/store';
import { formatClock } from '../../sim/needs';
import { Icon } from '../icons';

export function SocialFeedApp() {
  const engine = useGame((s) => s.engine)!;
  useGame((s) => s.version);
  const s = engine.state;
  const fr = s.settings.language === 'fr';
  const dispatch = useGame.getState().dispatch;
  const [post, setPost] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const feed = onlyMine ? s.socialFeed.filter((p) => p.authorId === 'player') : s.socialFeed;
  const followers = Number(s.storyFlags['followers'] ?? 20);

  return (
    <div>
      <div className="city-hero">
        <h3>{fr ? 'Le quartier parle' : 'The quartier is talking'}</h3>
        <p>
          {followers.toLocaleString()} {fr ? 'abonnés' : 'followers'} · {s.stats.socialPosts}{' '}
          {fr ? 'publications' : 'posts'} · {s.phone.dataCreditMb.toFixed(0)} MB
        </p>
        <div className="chip-row" style={{ marginTop: 8 }}>
          <button className={!onlyMine ? 'selected' : ''} onClick={() => setOnlyMine(false)}>
            {fr ? 'Tout le quartier' : 'Whole quartier'}
          </button>
          <button className={onlyMine ? 'selected' : ''} onClick={() => setOnlyMine(true)}>
            {fr ? 'Mes posts' : 'My posts'}
          </button>
        </div>
      </div>

      <div className="compose">
        <input
          value={post}
          maxLength={280}
          onChange={(e) => setPost(e.target.value)}
          placeholder={fr ? 'Quoi de neuf à Yaoundé ?' : "What's happening in Yaounde?"}
        />
        <button
          disabled={!post.trim()}
          onClick={() => {
            dispatch({ type: 'social_post', text: post.trim() });
            setPost('');
          }}
        >
          {fr ? 'Publier' : 'Post'}
        </button>
      </div>
      <div className="muted small" style={{ marginTop: 4 }}>
        {fr ? 'Chaque publication coûte 10 MB de data.' : 'Each post costs 10 MB of data.'}
      </div>

      <div className="feed">
        {feed.map((p) => (
          <div key={p.id} className="feed-post">
            <div className="feed-head">
              <span className="feed-avatar">{p.authorName.trim().charAt(0).toUpperCase()}</span>
              <div className="feed-head-main">
                <strong>
                  {p.authorId === 'player' ? (fr ? 'Toi' : 'You') : p.authorName}
                  {p.authorId === 'player' ? ` · ${s.player.name}` : ''}
                </strong>
                <span>
                  {fr ? 'Jour' : 'Day'} {p.day} · {formatClock(p.minute)}
                </span>
              </div>
            </div>
            <div className="feed-body">{fr && p.textFr ? p.textFr : p.text}</div>
            <div className="feed-actions">
              <button
                className={p.likedByPlayer ? 'feed-liked' : ''}
                onClick={() => dispatch({ type: 'social_like', postId: p.id })}
              >
                <Icon name="affection" size={12} /> {p.likes}
              </button>
              <button
                onClick={() =>
                  useGame.getState().setModal({
                    kind: 'dialogue',
                    npcId: p.authorId === 'player' ? 'uncle_baba' : p.authorId,
                  })
                }
                disabled={p.authorId === 'player'}
              >
                <Icon name="chat" size={12} /> {fr ? 'Répondre' : 'Reply'}
              </button>
            </div>
          </div>
        ))}
        {feed.length === 0 && (
          <div className="muted small">
            {fr ? 'Rien ici. Publie quelque chose ou reviens demain.' : 'Nothing here. Post something or come back tomorrow.'}
          </div>
        )}
      </div>
    </div>
  );
}
