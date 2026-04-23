/**
 * 事件总线 - 用于页面间通信
 */
class EventBus {
  private listeners: Map<string, Set<Function>> = new Map()

  /**
   * 监听事件
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)?.add(callback)
  }

  /**
   * 取消监听事件
   */
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback)
    }
  }

  /**
   * 发送事件
   */
  emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }
}

export const eventBus = new EventBus()
