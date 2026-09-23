import { Component } from "react";

export default class Phase7ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("VoicePrint UI error", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="crash-page">
        <div className="crash-card">
          <span className="panel-kicker">VOICEPRINT SAFETY UI</span>
          <h1>The interface needs to restart.</h1>
          <p>Your local safety system could not render this screen correctly. Restart the page before continuing.</p>
          <button className="primary-btn" onClick={() => window.location.reload()}>Restart VoicePrint</button>
        </div>
      </main>
    );
  }
}