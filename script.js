// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    initAnimations();
    initInteractions();
    initRealTimeUpdates();
});

// Initialize animations
function initAnimations() {
    // Animate stats on load
    animateStats();
    
    // Animate audience bars
    animateAudienceBars();
    
    // Add entrance animations
    addEntranceAnimations();
}

// Animate stat values counting up
function animateStats() {
    const statValues = document.querySelectorAll('.stat-value');
    
    statValues.forEach(stat => {
        const finalValue = stat.textContent;
        const isPercentage = finalValue.includes('%');
        const numericValue = parseFloat(finalValue.replace(/[,%]/g, ''));
        const duration = 2000;
        const steps = 60;
        const increment = numericValue / steps;
        let current = 0;
        let step = 0;
        
        stat.textContent = isPercentage ? '0%' : '0';
        
        const timer = setInterval(() => {
            step++;
            current += increment;
            
            if (step >= steps) {
                stat.textContent = finalValue;
                clearInterval(timer);
            } else {
                if (isPercentage) {
                    stat.textContent = current.toFixed(1) + '%';
                } else if (numericValue > 100) {
                    stat.textContent = Math.floor(current).toLocaleString();
                } else {
                    stat.textContent = Math.floor(current);
                }
            }
        }, duration / steps);
    });
}

// Animate audience bars
function animateAudienceBars() {
    const bars = document.querySelectorAll('.audience-fill');
    
    // Reset widths
    bars.forEach(bar => {
        const targetWidth = bar.style.width;
        bar.dataset.targetWidth = targetWidth;
        bar.style.width = '0%';
    });
    
    // Animate after a short delay
    setTimeout(() => {
        bars.forEach((bar, index) => {
            setTimeout(() => {
                bar.style.width = bar.dataset.targetWidth;
            }, index * 100);
        });
    }, 500);
}

// Add entrance animations
function addEntranceAnimations() {
    const elements = document.querySelectorAll('.stat-card, .panel, .analysis-item, .activity-item');
    
    elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, index * 50);
    });
}

// Initialize interactions
function initInteractions() {
    // Add hover effects to cards
    addCardHoverEffects();
    
    // Add click handlers
    addClickHandlers();
    
    // Add keyboard navigation
    addKeyboardNavigation();
}

// Add card hover effects
function addCardHoverEffects() {
    const cards = document.querySelectorAll('.stat-card, .panel, .analysis-item, .quick-action-btn');
    
    cards.forEach(card => {
        card.addEventListener('mouseenter', (e) => {
            createRipple(e, card);
        });
    });
}

// Create ripple effect
function createRipple(event, element) {
    const ripple = document.createElement('div');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.style.position = 'absolute';
    ripple.style.borderRadius = '50%';
    ripple.style.background = 'rgba(139, 92, 246, 0.1)';
    ripple.style.transform = 'scale(0)';
    ripple.style.animation = 'ripple 0.6s ease-out';
    ripple.style.pointerEvents = 'none';
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// Add ripple animation
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(2);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Add click handlers
function addClickHandlers() {
    // Navigation items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Add feedback animation
            item.style.transform = 'scale(0.95)';
            setTimeout(() => {
                item.style.transform = '';
            }, 100);
        });
    });
    
    // Quick action buttons
    const quickActions = document.querySelectorAll('.quick-action-btn');
    quickActions.forEach(btn => {
        btn.addEventListener('click', () => {
            showNotification('Action triggered!', 'success');
        });
    });
    
    // Primary button
    const primaryBtn = document.querySelector('.btn-primary');
    if (primaryBtn) {
        primaryBtn.addEventListener('click', () => {
            showNotification('Starting new analysis...', 'info');
        });
    }
    
    // Analysis items
    const analysisItems = document.querySelectorAll('.analysis-item');
    analysisItems.forEach(item => {
        item.addEventListener('click', () => {
            item.style.transform = 'scale(0.98)';
            setTimeout(() => {
                item.style.transform = '';
            }, 100);
        });
    });
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    notification.style.position = 'fixed';
    notification.style.top = '100px';
    notification.style.right = '40px';
    notification.style.padding = '16px 24px';
    notification.style.borderRadius = '12px';
    notification.style.background = 'rgba(26, 26, 36, 0.95)';
    notification.style.border = '1px solid rgba(139, 92, 246, 0.3)';
    notification.style.color = '#fff';
    notification.style.fontSize = '14px';
    notification.style.fontWeight = '500';
    notification.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.3)';
    notification.style.backdropFilter = 'blur(20px)';
    notification.style.zIndex = '1000';
    notification.style.transform = 'translateX(400px)';
    notification.style.transition = 'transform 0.3s ease';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Add keyboard navigation
function addKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            showNotification('Search feature coming soon!', 'info');
        }
        
        // Ctrl/Cmd + N for new analysis
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            showNotification('Starting new analysis...', 'info');
        }
    });
}

// Initialize real-time updates
function initRealTimeUpdates() {
    // Simulate real-time stat updates
    setInterval(() => {
        updateStats();
    }, 5000);
    
    // Simulate new activity
    setInterval(() => {
        addNewActivity();
    }, 10000);
    
    // Update processing status
    updateProcessingStatus();
}

// Update stats with random increments
function updateStats() {
    const statValues = document.querySelectorAll('.stat-value');
    
    statValues.forEach(stat => {
        const currentValue = stat.textContent;
        const isPercentage = currentValue.includes('%');
        
        if (!isPercentage) {
            const numericValue = parseInt(currentValue.replace(/,/g, ''));
            const increment = Math.floor(Math.random() * 5) + 1;
            const newValue = numericValue + increment;
            
            // Animate the change
            stat.style.transform = 'scale(1.1)';
            stat.style.color = '#10B981';
            
            setTimeout(() => {
                stat.textContent = newValue.toLocaleString();
                stat.style.transform = '';
                stat.style.color = '';
            }, 200);
        }
    });
}

// Add new activity to feed
function addNewActivity() {
    const activityFeed = document.querySelector('.activity-feed');
    if (!activityFeed) return;
    
    const activities = [
        { name: 'Alex Chen', initials: 'AC', action: 'analyzed', repo: 'vue-dashboard' },
        { name: 'Maria Garcia', initials: 'MG', action: 'connected a new repository', repo: null },
        { name: 'James Wilson', initials: 'JW', action: 'shared analysis with', audience: 'Product Managers' },
        { name: 'Lisa Anderson', initials: 'LA', action: 'updated team settings', repo: null }
    ];
    
    const randomActivity = activities[Math.floor(Math.random() * activities.length)];
    
    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    activityItem.style.opacity = '0';
    activityItem.style.transform = 'translateY(-20px)';
    
    let actionText = `<strong>${randomActivity.name}</strong> ${randomActivity.action}`;
    if (randomActivity.repo) {
        actionText += ` <span class="activity-highlight">${randomActivity.repo}</span>`;
    } else if (randomActivity.audience) {
        actionText += ` <span class="activity-highlight">${randomActivity.audience}</span>`;
    }
    
    activityItem.innerHTML = `
        <div class="activity-avatar">
            <span>${randomActivity.initials}</span>
        </div>
        <div class="activity-content">
            <div class="activity-text">${actionText}</div>
            <div class="activity-time">Just now</div>
        </div>
    `;
    
    activityFeed.insertBefore(activityItem, activityFeed.firstChild);
    
    // Animate in
    setTimeout(() => {
        activityItem.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        activityItem.style.opacity = '1';
        activityItem.style.transform = 'translateY(0)';
    }, 10);
    
    // Remove oldest if more than 4
    const items = activityFeed.querySelectorAll('.activity-item');
    if (items.length > 4) {
        const lastItem = items[items.length - 1];
        lastItem.style.opacity = '0';
        lastItem.style.transform = 'translateY(20px)';
        setTimeout(() => {
            lastItem.remove();
        }, 300);
    }
    
    // Update times
    updateActivityTimes();
}

// Update activity times
function updateActivityTimes() {
    const times = document.querySelectorAll('.activity-time');
    times.forEach((time, index) => {
        if (index === 0) {
            time.textContent = 'Just now';
        } else if (index === 1) {
            time.textContent = '5 minutes ago';
        } else if (index === 2) {
            time.textContent = '15 minutes ago';
        } else {
            time.textContent = '1 hour ago';
        }
    });
}

// Update processing status
function updateProcessingStatus() {
    const processingItems = document.querySelectorAll('.analysis-status.processing');
    
    processingItems.forEach(status => {
        setTimeout(() => {
            status.classList.remove('processing');
            status.classList.add('completed');
            status.innerHTML = '<span class="status-dot"></span>Completed';
            
            // Add completion animation
            const item = status.closest('.analysis-item');
            item.style.transform = 'scale(1.02)';
            setTimeout(() => {
                item.style.transform = '';
            }, 300);
            
            showNotification('Analysis completed!', 'success');
        }, 8000);
    });
}

// Add particle effect on hover
function addParticleEffect(element) {
    const particles = 5;
    const rect = element.getBoundingClientRect();
    
    for (let i = 0; i < particles; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'fixed';
        particle.style.width = '4px';
        particle.style.height = '4px';
        particle.style.borderRadius = '50%';
        particle.style.background = 'rgba(139, 92, 246, 0.6)';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '9999';
        
        const x = rect.left + Math.random() * rect.width;
        const y = rect.top + Math.random() * rect.height;
        
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        
        document.body.appendChild(particle);
        
        const angle = Math.random() * Math.PI * 2;
        const velocity = 2 + Math.random() * 2;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;
        
        let opacity = 1;
        let posX = x;
        let posY = y;
        
        const animate = () => {
            posX += vx;
            posY += vy;
            opacity -= 0.02;
            
            particle.style.left = posX + 'px';
            particle.style.top = posY + 'px';
            particle.style.opacity = opacity;
            
            if (opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                particle.remove();
            }
        };
        
        animate();
    }
}

// Add particle effects to stat cards
document.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
        addParticleEffect(card);
    });
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add loading state simulation
window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
});

console.log('🚀 RepoTalk Dashboard initialized');
console.log('💡 Keyboard shortcuts:');
console.log('   Ctrl/Cmd + K: Search');
console.log('   Ctrl/Cmd + N: New Analysis');

// Made with Bob
